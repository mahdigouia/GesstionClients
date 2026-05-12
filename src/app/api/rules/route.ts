import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    const filePath = path.join(process.cwd(), 'regles_et_plans.md');
    
    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: 'Fichier non trouvé' }, { status: 404 });
    }

    const content = fs.readFileSync(filePath, 'utf8');
    
    return new NextResponse(content, {
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
        'Content-Disposition': 'inline; filename="regles_et_plans.md"',
      },
    });
  } catch (error) {
    console.error('Error reading rules file:', error);
    return NextResponse.json({ error: 'Erreur lors de la lecture du fichier' }, { status: 500 });
  }
}
