"""
Microservice Python pour extraction de tableaux PDF
Utilise pdfplumber (primaire) et Camelot (fallback)
"""

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import pdfplumber
import tempfile
import os
import re
from typing import List, Dict, Any, Optional
from dataclasses import dataclass
from pydantic import BaseModel

# Camelot est optionnel (difficile à installer sur Windows sans Ghostscript)
try:
    import camelot
    CAMELOT_AVAILABLE = True
except ImportError:
    CAMELOT_AVAILABLE = False
    camelot = None

app = FastAPI(title="PDF Table Extractor", version="1.0.0")

# CORS pour permettre les appels depuis Next.js
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # En production, spécifier l'URL exacte
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ExtractedTable(BaseModel):
    page: int
    table_index: int
    data: List[List[str]]
    bbox: Optional[List[float]] = None
    parsing_method: str


class ExtractResponse(BaseModel):
    success: bool
    tables: List[ExtractedTable]
    total_pages: int
    method_used: str
    extracted_text: Optional[str] = None


class DebtData(BaseModel):
    """Structure d'une créance extraite"""
    id: int
    client_code: str
    client_name: str
    client_phone: Optional[str] = None
    due_date: str
    document_date: Optional[str] = ""
    document_number: Optional[str] = ""
    age: Optional[int] = 0
    description: Optional[str] = ""
    amount: float
    settlement: Optional[float] = 0.0
    balance: float
    commercial_code: Optional[str] = None
    commercial_name: Optional[str] = None


@dataclass
class ExtractionContext:
    """Contexte de l'extraction pour conserver l'état entre les pages"""
    current_commercial: Optional[Dict[str, str]] = None
    current_client: Optional[Dict[str, str]] = None
    debts: List[DebtData] = None
    
    def __post_init__(self):
        if self.debts is None:
            self.debts = []


def parse_tunisian_amount(amount_str: str) -> float:
    """Convertit un montant tunisien en nombre: '1 264,277' -> 1264.277, '-28,808' -> -28.808"""
    if not amount_str:
        return 0.0
    # Préserver le signe négatif
    negative = '-' in amount_str
    cleaned = amount_str.replace('-', '').replace(' ', '').replace(',', '.')
    try:
        value = float(cleaned)
        return -value if negative else value
    except ValueError:
        return 0.0


def parse_date(date_str: str) -> str:
    """Normalise une date DD/MM/YYYY -> YYYY-MM-DD"""
    if not date_str:
        return ""
    match = re.match(r'(\d{2})[\/\-](\d{2})[\/\-](\d{4})', date_str)
    if match:
        day, month, year = match.groups()
        return f"{year}-{month}-{day}"
    return date_str


def is_client_row(row: List[Any]) -> bool:
    """Détecte si une ligne contient des informations client"""
    if not row:
        return False
    first_cell = str(row[0] or '').strip()
    # Code client: 4 chiffres suivi d'un nom (pas une date, pas un montant)
    if not re.match(r'^\d{4}$', first_cell):
        return False
    # Vérifier que ce n'est pas une ligne de données (qui commence aussi par 4 chiffres parfois)
    row_text = ' '.join(str(cell or '') for cell in row)
    has_date = bool(re.search(r'\d{2}[\/\-]\d{2}[\/\-]\d{4}', row_text))
    has_amount = bool(re.search(r'\d+,\d{3}', row_text))  # Format TND avec virgule
    # Si ça a une date ET un montant, c'est une ligne de données, pas un client
    return not (has_date and has_amount)


def extract_client_info(row: List[str]) -> Optional[Dict[str, str]]:
    """Extrait les informations client d'une ligne"""
    if not row:
        return None
    
    code = row[0].strip()
    
    # Concaténer toutes les cellules pour former le nom (gère les noms avec espaces)
    # Exclure les cellules qui ressemblent à des dates, montants ou téléphones
    name_parts = []
    for i, cell in enumerate(row[1:], 1):  # Skip first cell (code)
        cell = cell.strip()
        if not cell:
            continue
        # Ignorer les dates
        if re.match(r'\d{2}[\/\-]\d{2}[\/\-]\d{4}', cell):
            continue
        # Ignorer les montants TND
        if re.search(r'\d+,\d{3}', cell):
            continue
        # Ignorer les numéros de téléphone seuls
        if re.match(r'^(?:\d{2}\s*){4}$', cell.replace('.', '').replace('-', '')):
            continue
        name_parts.append(cell)
    
    name = ' '.join(name_parts).strip()
    
    # Si on n'a pas trouvé de nom, essayer la deuxième cellule brute
    if not name and len(row) > 1:
        name = row[1].strip()
    
    # Chercher un numéro de téléphone dans toute la ligne
    phone = None
    for cell in row:
        # Format tunisien: 98 22 71 06 ou 72200800
        phone_match = re.search(r'(\d{2}[\s\.]?\d{2}[\s\.]?\d{2}[\s\.]?\d{2})', cell)
        if phone_match:
            phone = phone_match.group(1).replace(' ', '').replace('.', '')
            break
    
    return {
        "code": code,
        "name": name,
        "phone": phone
    }


def is_data_row(row: List[Any]) -> bool:
    """Vérifie si une ligne contient des données de créance"""
    if not row or len(row) < 3:
        return False
    
    # Filtrer les None et convertir en str
    row_text = ' '.join(str(cell or '') for cell in row)
    # Doit contenir une date et un montant tunisien
    has_date = bool(re.search(r'\d{2}[\/\-]\d{2}[\/\-]\d{4}', row_text))
    has_amount = bool(re.search(r'\d+[\s,]\d{3}', row_text))  # Format TND
    return has_date and has_amount


def parse_data_row(
    row: List[Any], 
    client: Dict[str, str], 
    context: ExtractionContext
) -> Optional[DebtData]:
    """Parse une ligne de données de créance"""
    try:
        # Filtrer les None et convertir en str
        row_text = ' '.join(str(cell or '') for cell in row)
        
        # Extraire les dates
        dates = re.findall(r'(\d{2}[\/\-]\d{2}[\/\-]\d{4})', row_text)
        if len(dates) < 1:
            return None
        
        due_date = dates[0] if len(dates) > 0 else ""
        doc_date = dates[-1] if len(dates) > 1 else due_date
        
        # Extraire le numéro de pièce (FT######, FS######, IC######, AV######, AVT/AVS/FRS/FRT)
        doc_match = re.search(r'(FT\d{6}|FS\d{6}|IC\d{6}|AVT\d{5,8}|AVS\d{5,8}|AV\d{5,8}|FRS\d+|FRT\d+)', row_text, re.IGNORECASE)
        doc_number = doc_match.group(1).upper() if doc_match else "DOC"
        
        # Extraire l'âge (nombre avant "jours" ou après les dates)
        age = 0
        age_match = re.search(r'(\d+)\s*(?:j|jours|J\.P|Nbr\.J\.P)', row_text, re.IGNORECASE)
        if age_match:
            age = int(age_match.group(1))
        
        # Extraire les montants (chercher tous les nombres avec virgule)
        amounts = []
        for cell in row:
            # Pattern montant tunisien: 1 264,277 ou 264,277 ou 0,000 ou -28,808
            # Utilisation de lookbehind pour éviter de coller un chiffre précédent (ex: BC number)
            amount_matches = re.findall(r'(?<!\d)(?:-?\d{1,3}(?:\s\d{3})*,\d{3}|-?\d+,\d{3})', cell)
            for match in amount_matches:
                amounts.append(parse_tunisian_amount(match))
        
        # Les 3 derniers montants sont: Montant, Règlement, Solde
        amount = settlement = balance = 0.0
        if len(amounts) >= 3:
            amount = amounts[-3]
            settlement = amounts[-2]
            balance = amounts[-1]
        elif len(amounts) >= 2:
            amount = amounts[-2]
            balance = amounts[-1]
            settlement = amount - balance
        elif len(amounts) == 1:
            amount = amounts[0]
            balance = amounts[0]
        
        # Vérification cohérence: solde devrait être ≈ montant - règlement
        if abs((amount - settlement) - balance) > 1.0:
            # Incohérence, prendre les valeurs telles quelles
            pass
        
        # Description: tout ce qui n'est pas date, montant, ou numéro de pièce
        description = "FACTURE"
        for cell in row:
            if cell and not re.match(r'\d{2}[\/\-]\d{2}[\/\-]\d{4}', cell):
                if not re.search(r'(?:FT|FS|IC|AV)\d+', cell, re.IGNORECASE):
                    if not re.search(r'\d+,\d{3}', cell):
                        desc = cell.strip()
                        if desc and len(desc) > 2:
                            description = desc
                            break
        
        # Générer ID unique
        debt_id = len(context.debts) + 1
        
        return DebtData(
            id=debt_id,
            client_code=client.get("code", ""),
            client_name=client.get("name", ""),
            client_phone=client.get("phone"),
            due_date=parse_date(due_date),
            document_date=parse_date(doc_date),
            document_number=doc_number,
            age=age,
            description=description,
            amount=amount,
            settlement=settlement,
            balance=balance,
            commercial_code=context.current_commercial.get("code") if context.current_commercial else None,
            commercial_name=context.current_commercial.get("name") if context.current_commercial else None
        )
        
    except Exception as e:
        print(f"Erreur parsing ligne: {e}")
        return None


def parse_text_line(line: str, client: Dict[str, str], context: ExtractionContext) -> Optional[DebtData]:
    """Parse une ligne de créance avec une robustesse accrue pour les montants tunisiens"""
    try:
        # Nettoyage initial
        line = line.replace('""', '"').strip()
        
        # 1. Extraire les dates
        dates = re.findall(r'(\d{2})[\/\-](\d{2})[\/\-](\d{4})', line)
        if len(dates) < 1:
            return None
        
        due_date = f"{dates[0][2]}-{dates[0][1]}-{dates[0][0]}"
        doc_date = f"{dates[1][2]}-{dates[1][1]}-{dates[1][0]}" if len(dates) > 1 else due_date
        
        # 2. Identifier le numéro de pièce
        doc_match = re.search(r'\b(FT\d{6}|FS\d{6}|IC\d{6}|AV[A-Z]*\d+)\b', line, re.IGNORECASE)
        document_number = doc_match.group(1).upper() if doc_match else "DOC"
        
        # 3. Extraire l'âge et NbrJP
        # On cherche les nombres simples (sans virgule) qui suivent le doc_number ou les dates
        age = 0
        nbr_jp = 0
        
        # On nettoie temporairement la ligne pour trouver les tokens restants
        temp_line = line
        for d in dates:
            temp_line = temp_line.replace(f"{d[0]}/{d[1]}/{d[2]}", " [DATE] ")
        if doc_match:
            temp_line = temp_line.replace(doc_match.group(0), " [PIECE] ")
            
        tokens = temp_line.split()
        numeric_tokens = []
        for i, t in enumerate(tokens):
            if re.match(r'^\d+$', t) and len(t) < 5:
                numeric_tokens.append((i, t))
        
        # L'âge et NbrJP sont généralement les premiers nombres après [PIECE] ou au début
        if numeric_tokens:
            age = int(numeric_tokens[0][1])
            if len(numeric_tokens) > 1:
                # Si le 2ème nombre est juste après le 1er ou très proche, c'est NbrJP
                if numeric_tokens[1][0] <= numeric_tokens[0][0] + 2:
                    nbr_jp = int(numeric_tokens[1][1])

        # 4. Extraire les montants
        # On cherche d'abord tous les tokens avec virgule
        # On utilise une approche par tokens pour être sûr des positions
        tokens_all = line.split()
        amounts_candidates = []
        
        for i, t in enumerate(tokens_all):
            if re.search(r'-?\d+,\d{3}', t):
                val_base = parse_tunisian_amount(t)
                prefix = None
                # Vérifier le token précédent
                if i > 0 and re.match(r'^\d{1,3}$', tokens_all[i-1]):
                    # C'est un millier potentiel
                    prefix = tokens_all[i-1]
                
                amounts_candidates.append({
                    "val": val_base,
                    "full_str": t,
                    "prefix": prefix
                })
        
        if len(amounts_candidates) < 1:
            return None
            
        # Résolution des 3 montants (M, R, S)
        m = r = s = 0.0
        used_prefixes = []
        
        if len(amounts_candidates) >= 3:
            # On prend les 3 derniers
            candidates = amounts_candidates[-3:]
            
            best_diff = 999999.0
            best_sum = -1.0
            best_vals = (0.0, 0.0, 0.0)
            best_comb = (0, 0, 0)
            
            # Essayer toutes les combinaisons de préfixes
            for i in [0, 1]:
                for j in [0, 1]:
                    for k in [0, 1]:
                        v_m = parse_tunisian_amount(f"{candidates[0]['prefix']} {candidates[0]['full_str']}") if i and candidates[0]['prefix'] else candidates[0]['val']
                        v_r = parse_tunisian_amount(f"{candidates[1]['prefix']} {candidates[1]['full_str']}") if j and candidates[1]['prefix'] else candidates[1]['val']
                        v_s = parse_tunisian_amount(f"{candidates[2]['prefix']} {candidates[2]['full_str']}") if k and candidates[2]['prefix'] else candidates[2]['val']
                        
                        diff = abs((v_m - v_r) - v_s)
                        curr_sum = v_m + v_r + v_s
                        
                        # Priorité absolue à la cohérence (diff proche de 0)
                        # Puis priorité à la somme la plus grande (capture des milliers)
                        if diff < best_diff - 0.001 or (abs(diff - best_diff) < 0.001 and curr_sum > best_sum):
                            best_diff = diff
                            best_sum = curr_sum
                            best_vals = (v_m, v_r, v_s)
                            best_comb = (i, j, k)
            
            m, r, s = best_vals
            if best_comb[0] and candidates[0]['prefix']: used_prefixes.append(candidates[0]['prefix'])
            if best_comb[1] and candidates[1]['prefix']: used_prefixes.append(candidates[1]['prefix'])
            if best_comb[2] and candidates[2]['prefix']: used_prefixes.append(candidates[2]['prefix'])
        elif len(amounts_candidates) == 2:
            # Souvent Montant et Solde
            m = parse_tunisian_amount(f"{amounts_candidates[0]['prefix']} {amounts_candidates[0]['full_str']}") if amounts_candidates[0]['prefix'] else amounts_candidates[0]['val']
            s = parse_tunisian_amount(f"{amounts_candidates[1]['prefix']} {amounts_candidates[1]['full_str']}") if amounts_candidates[1]['prefix'] else amounts_candidates[1]['val']
            r = m - s
            if amounts_candidates[0]['prefix']: used_prefixes.append(amounts_candidates[0]['prefix'])
            if amounts_candidates[1]['prefix']: used_prefixes.append(amounts_candidates[1]['prefix'])
        else:
            m = s = parse_tunisian_amount(f"{amounts_candidates[0]['prefix']} {amounts_candidates[0]['full_str']}") if amounts_candidates[0]['prefix'] else amounts_candidates[0]['val']
            r = 0.0
            if amounts_candidates[0]['prefix']: used_prefixes.append(amounts_candidates[0]['prefix'])

        # 5. Extraire la description
        remaining = line
        for d in dates: remaining = remaining.replace(f"{d[0]}/{d[1]}/{d[2]}", "")
        if doc_match: remaining = remaining.replace(doc_match.group(0), "")
        if age > 0: remaining = remaining.replace(str(age), "", 1)
        if nbr_jp > 0: remaining = remaining.replace(str(nbr_jp), "", 1)
        
        # Enlever les montants exacts (comma tokens)
        for ct in [c['full_str'] for c in amounts_candidates]:
            remaining = remaining.replace(ct, "")
        
        # Enlever SEULEMENT les milliers UTILISÉS
        for p in used_prefixes:
            remaining = re.sub(r'\b' + re.escape(p) + r'\b', "", remaining, count=1)
        
        # Nettoyer les tokens restants
        desc_tokens = remaining.split()
        clean_desc_tokens = []
        for t in desc_tokens:
            # Garder si c'est du texte ou un nombre significatif (pas un millier résiduel d'un montant)
            if not re.match(r'^\d+$', t) or len(t) > 3:
                clean_desc_tokens.append(t)
            elif t in ["2", "3", "4", "5", "6", "7", "8", "9"] and len(remaining) > 20:
                # Probablement un chiffre dans le nom si la ligne est longue
                clean_desc_tokens.append(t)
        
        description = " ".join(clean_desc_tokens).strip()
        if not description or len(description) < 2:
            description = "FACTURE"

        return DebtData(
            id=len(context.debts) + 1,
            client_code=client["code"],
            client_name=client["name"],
            client_phone=client.get("phone"),
            document_number=document_number,
            due_date=due_date,
            document_date=doc_date,
            amount=m,
            settlement=r,
            balance=s,
            age=age,
            description=description,
            commercial_code=context.current_commercial.get("code") if context.current_commercial else None,
            commercial_name=context.current_commercial.get("name") if context.current_commercial else None
        )
        
    except Exception as e:
        print(f"[PDF Extract] Erreur parse_text_line: {e}")
        return None


def detect_commercial(row: List[Any]) -> Optional[Dict[str, str]]:
    """Détecte le commercial dans une ligne"""
    row_text = ' '.join(str(cell or '') for cell in row)
    
    # Pattern: C## NOM COMMERCIAL
    match = re.search(r'(C\d{2})\s+([A-Z][A-Z\s\-]{3,})', row_text)
    if match:
        return {
            "code": match.group(1),
            "name": match.group(2).strip()
        }
    return None


def is_header_row(row: List[Any]) -> bool:
    """Détecte si c'est une ligne d'en-tête de tableau"""
    header_keywords = ['echéance', 'date', 'pièce', 'montant', 'règlement', 'solde', 'intitulé']
    row_text = ' '.join(str(cell or '') for cell in row).lower()
    return any(kw in row_text for kw in header_keywords)


@app.post("/extract", response_model=ExtractResponse)
async def extract_pdf(file: UploadFile = File(...)):
    """
    Extrait les tableaux et créances d'un PDF
    """
    if not file.filename.lower().endswith('.pdf'):
        raise HTTPException(400, detail="Seuls les fichiers PDF sont acceptés")
    
    # Sauvegarder le fichier temporairement
    with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = tmp.name
    
    try:
        tables: List[ExtractedTable] = []
        context = ExtractionContext()
        method_used = ""
        
        # === STRATEGIE 1: pdfplumber ===
        try:
            with pdfplumber.open(tmp_path) as pdf:
                for page_num, page in enumerate(pdf.pages, 1):
                    # Extraire les tables
                    page_tables = page.extract_tables()
                    
                    for table_idx, table in enumerate(page_tables):
                        if table and len(table) > 0:
                            tables.append(ExtractedTable(
                                page=page_num,
                                table_index=table_idx,
                                data=table,
                                bbox=page.bbox if hasattr(page, 'bbox') else None,
                                parsing_method="pdfplumber"
                            ))
                            
                            # Parser les créances directement
                            for row in table:
                                if not row:
                                    continue
                                
                                # Détecter commercial
                                commercial = detect_commercial(row)
                                if commercial:
                                    context.current_commercial = commercial
                                    continue
                                
                                # Ignorer lignes d'en-tête
                                if is_header_row(row):
                                    continue
                                
                                # Détecter client
                                if is_client_row(row):
                                    client_info = extract_client_info(row)
                                    if client_info:
                                        context.current_client = client_info
                                    continue
                                
                                # Parser données
                                if is_data_row(row) and context.current_client:
                                    debt = parse_data_row(row, context.current_client, context)
                                    if debt:
                                        context.debts.append(debt)
            
            method_used = "pdfplumber"
            
        except Exception as e:
            print(f"pdfplumber échec: {e}")
        
        # === STRATEGIE 2: Camelot (si pdfplumber n'a rien trouvé) ===
        if not tables and CAMELOT_AVAILABLE:
            try:
                camelot_tables = camelot.read_pdf(tmp_path, pages='all', flavor='lattice')
                
                for table in camelot_tables:
                    df = table.df
                    if not df.empty:
                        tables.append(ExtractedTable(
                            page=table.page,
                            table_index=table.order,
                            data=df.values.tolist(),
                            bbox=None,
                            parsing_method="camelot-lattice"
                        ))
                
                if tables:
                    method_used = "camelot"
                    
            except Exception as e:
                print(f"Camelot échec: {e}")
        
        # === STRATEGIE 3: Camelot stream (dernier recours) ===
        if not tables and CAMELOT_AVAILABLE:
            try:
                camelot_tables = camelot.read_pdf(tmp_path, pages='all', flavor='stream')
                
                for table in camelot_tables:
                    df = table.df
                    if not df.empty:
                        tables.append(ExtractedTable(
                            page=table.page,
                            table_index=table.order,
                            data=df.values.tolist(),
                            bbox=None,
                            parsing_method="camelot-stream"
                        ))
                
                if tables:
                    method_used = "camelot-stream"
                    
            except Exception as e:
                print(f"Camelot stream échec: {e}")
        
        # Nombre de pages
        num_pages = 0
        try:
            with pdfplumber.open(tmp_path) as pdf:
                num_pages = len(pdf.pages)
        except:
            pass
        
        return ExtractResponse(
            success=len(tables) > 0,
            tables=tables,
            total_pages=num_pages,
            method_used=method_used or "none",
            extracted_text=None  # Peut être ajouté si nécessaire
        )
        
    finally:
        os.unlink(tmp_path)


@app.post("/extract-debts")
async def extract_debts(file: UploadFile = File(...)):
    """
    Extrait directement les créances du PDF (endpoint optimisé)
    Retourne une liste de DebtData structurée
    """
    if not file.filename.lower().endswith('.pdf'):
        raise HTTPException(400, detail="Seuls les fichiers PDF sont acceptés")
    
    with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = tmp.name
    
    try:
        context = ExtractionContext()
        total_pages = 0
        pages_with_tables = 0
        total_tables = 0
        
        with pdfplumber.open(tmp_path) as pdf:
            total_pages = len(pdf.pages)
            print(f"[PDF Extract] PDF ouvert: {total_pages} pages")
            
            for page_idx, page in enumerate(pdf.pages, 1):
                # Essayer d'abord avec les paramètres par défaut
                tables = page.extract_tables()
                print(f"[PDF Extract] Page {page_idx}: {len(tables) if tables else 0} tables (default)")
                
                # Si pas de tables, essayer avec des settings plus permissifs
                if not tables:
                    tables = page.extract_tables({
                        "vertical_strategy": "lines",
                        "horizontal_strategy": "lines",
                        "snap_tolerance": 3,
                        "join_tolerance": 3,
                    })
                    if tables:
                        print(f"[PDF Extract] Page {page_idx}: {len(tables)} tables (lines)")
                
                # Si toujours pas de tables, essayer avec text
                if not tables:
                    tables = page.extract_tables({
                        "vertical_strategy": "text",
                        "horizontal_strategy": "text",
                        "snap_tolerance": 5,
                        "join_tolerance": 5,
                        "min_words_vertical": 2,
                        "min_words_horizontal": 2,
                    })
                    if tables:
                        print(f"[PDF Extract] Page {page_idx}: {len(tables)} tables (text)")
                
                if tables:
                    pages_with_tables += 1
                    total_tables += len(tables)
                
                # NOUVELLE APPROCHE: Utiliser le texte brut pour les PDF avec tableaux imbriqués
                # car pdfplumber ne gère pas bien les structures complexes
                text = page.extract_text() or ""
                lines = text.split('\n')
                print(f"[PDF Extract] Page {page_idx}: {len(lines)} lignes de texte")
                
                sample_logged = False
                for line in lines:
                    line = line.strip()
                    if not line:
                        continue
                    
                    # Log les premières lignes pour debug
                    if not sample_logged:
                        print(f"[PDF Extract] Sample ligne: {line[:100]}")
                        sample_logged = True
                    
                    # Détecter commercial (ex: C01 MED AMINE BEN ZAARA)
                    match = re.search(r'(C\d{2})\s+([A-Z][A-Z\s\-]+)', line)
                    if match:
                        print(f"[PDF Extract] Commercial trouvé: {match.group(1)} - {match.group(2).strip()[:30]}")
                        context.current_commercial = {
                            "code": match.group(1),
                            "name": match.group(2).strip()
                        }
                        continue
                    
                    # Détecter client: code 4 chiffres + nom (ex: 0424 LA MANGEARIA)
                    # Pattern: début de ligne avec 4 chiffres suivis d'un nom
                    # Accepte: lettres, chiffres, espaces, tirets, apostrophes, guillemets, esperluette, parenthèses, points
                    # Mise à jour: Autorise le nom à commencer par un guillemet ou une lettre
                    client_match = re.match(r'^(\d{4})\s+([A-Za-z\'"][A-Za-z0-9\s\-\'"&().]+?)(?:\s+T[eé]l|\s*$)', line)
                    if client_match:
                        code = client_match.group(1)
                        name = client_match.group(2).strip()
                        
                        # Nettoyer les guillemets superflus au début/fin
                        name = name.strip('"').strip("'")
                        
                        # Nettoyer le nom: enlever le 'T' final collé
                        # car parfois le texte est collé: "LA MANGEARIA T" au lieu de "LA MANGEARIA Tél"
                        if name.endswith(' T'):
                            name = name[:-2].strip()
                        elif name.endswith(' T'):
                            name = name[:-2].strip()
                        
                        # Extraire téléphone si présent (format: 72 26 09 01 ou 72260901)
                        phone = None
                        phone_match = re.search(r'T[eé]l[:\s]+([\d\s\.]+)', line)
                        if phone_match:
                            phone = phone_match.group(1).replace(' ', '').replace('.', '')
                            # S'assurer que le téléphone a 8 chiffres
                            if len(phone) >= 8:
                                phone = phone[:8]
                        
                        context.current_client = {
                            "code": code,
                            "name": name,
                            "phone": phone
                        }
                        print(f"[PDF Extract] Client trouvé: {code} - {name[:30]} - Tél: {phone}")
                        continue
                    else:
                        # Log pour debug: montrer les lignes qui pourraient être des clients
                        if re.match(r'^\d{4}', line):
                            print(f"[PDF Extract] Ligne avec code 4 chiffres non matchée: {line[:60]}")
                    
                    # Parser données de créance
                    # Pattern: Date Echéance (DD/MM/YYYY) + Date Doc (DD/MM/YYYY) + N°pièce + Montants
                    # Ex: 14/08/2019 14/08/2019 IC000262 2 436 0 1 264,277 0,000 1 264,277
                    if context.current_client:
                        # Chercher une ligne avec 2 dates et des montants
                        date_pattern = r'\d{2}[\/\-]\d{2}[\/\-]\d{4}'
                        if re.search(date_pattern, line):
                            # Vérifier si c'est une ligne de données (contient des montants avec , ou .)
                            if re.search(r'\d{1,3}(?:[\s,]\d{3})+', line) or re.search(r'\d+,\d+', line):
                                debt = parse_text_line(line, context.current_client, context)
                                if debt:
                                    print(f"[PDF Extract] Créance trouvée: {debt.amount} TND pour {debt.client_name[:20]}")
                                    context.debts.append(debt)
        
        print(f"[PDF Extract] Total pages: {total_pages}, Pages avec tables: {pages_with_tables}, Tables trouvées: {total_tables}, Créances extraites: {len(context.debts)}")
        if context.current_commercial:
            print(f"[PDF Extract] Commercial détecté: {context.current_commercial}")
        if context.current_client:
            print(f"[PDF Extract] Dernier client: {context.current_client}")
        
        return {
            "success": len(context.debts) > 0,
            "debts": [debt.dict() for debt in context.debts],
            "count": len(context.debts),
            "commercial": context.current_commercial,
            "diagnostics": {
                "total_pages": total_pages,
                "pages_with_tables": pages_with_tables,
                "total_tables": total_tables
            }
        }
        
    finally:
        os.unlink(tmp_path)


@app.api_route("/health", methods=["GET", "HEAD"])
async def health_check():
    """Vérification de santé du service"""
    return {
        "status": "healthy",
        "service": "pdf-extractor",
        "version": "1.0.0"
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
