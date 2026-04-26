'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { 
  FileText, 
  User, 
  Phone, 
  Building2, 
  Search,
  X
} from 'lucide-react';
import { ClientDebt } from '@/types/debt';

interface Suggestion {
  value: string;
  type: 'document' | 'client' | 'phone' | 'commercial' | 'clientCode';
  label: string;
  subLabel: string;
  debt: ClientDebt;
}

interface AutocompleteSearchProps {
  debts: ClientDebt[];
  onSelect: (value: string) => void;
  onChange: (value: string) => void;
  placeholder?: string;
  value: string;
}

export function AutocompleteSearch({ 
  debts, 
  onSelect, 
  onChange, 
  placeholder = "Rechercher...",
  value 
}: AutocompleteSearchProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Update input value when prop changes
  useEffect(() => {
    setInputValue(value);
  }, [value]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Generate suggestions based on input
  const suggestions = useMemo(() => {
    if (!inputValue || inputValue.length < 1) return [];
    
    const searchLower = inputValue.toLowerCase();
    const suggestionMap = new Map<string, Suggestion>();
    
    debts.forEach(debt => {
      // Document Number
      if (debt.documentNumber?.toLowerCase().includes(searchLower)) {
        const key = `doc-${debt.documentNumber}`;
        if (!suggestionMap.has(key)) {
          suggestionMap.set(key, {
            value: debt.documentNumber,
            type: 'document',
            label: debt.documentNumber,
            subLabel: 'N° Pièce',
            debt
          });
        }
      }
      
      // Client Code
      if (debt.clientCode?.toLowerCase().includes(searchLower)) {
        const key = `code-${debt.clientCode}`;
        if (!suggestionMap.has(key)) {
          suggestionMap.set(key, {
            value: debt.clientCode,
            type: 'clientCode',
            label: debt.clientCode,
            subLabel: debt.clientName || 'Code Client',
            debt
          });
        }
      }
      
      // Client Name
      if (debt.clientName?.toLowerCase().includes(searchLower)) {
        const key = `client-${debt.clientName}`;
        if (!suggestionMap.has(key)) {
          suggestionMap.set(key, {
            value: debt.clientName || '',
            type: 'client',
            label: debt.clientName || '',
            subLabel: debt.clientCode || 'Client',
            debt
          });
        }
      }
      
      // Phone
      if (debt.clientPhone?.includes(searchLower)) {
        const key = `phone-${debt.clientPhone}`;
        if (!suggestionMap.has(key)) {
          suggestionMap.set(key, {
            value: debt.clientPhone || '',
            type: 'phone',
            label: debt.clientPhone || '',
            subLabel: debt.clientName || 'Téléphone',
            debt
          });
        }
      }
      
      // Commercial/Representant
      if (debt.commercialName?.toLowerCase().includes(searchLower)) {
        const key = `com-${debt.commercialName}`;
        if (!suggestionMap.has(key)) {
          suggestionMap.set(key, {
            value: debt.commercialName || '',
            type: 'commercial',
            label: debt.commercialName || '',
            subLabel: 'Représentant',
            debt
          });
        }
      }
    });
    
    // Return max 5 suggestions, prioritize exact matches
    return Array.from(suggestionMap.values())
      .sort((a, b) => {
        const aExact = a.value.toLowerCase().startsWith(searchLower);
        const bExact = b.value.toLowerCase().startsWith(searchLower);
        if (aExact && !bExact) return -1;
        if (!aExact && bExact) return 1;
        return 0;
      })
      .slice(0, 5);
  }, [debts, inputValue]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    onChange(newValue);
    setIsOpen(newValue.length > 0);
  };

  const handleSelect = (suggestion: Suggestion) => {
    setInputValue(suggestion.value);
    onSelect(suggestion.value);
    onChange(suggestion.value);
    setIsOpen(false);
  };

  const clearInput = () => {
    setInputValue('');
    onChange('');
    inputRef.current?.focus();
  };

  const getIcon = (type: Suggestion['type']) => {
    switch (type) {
      case 'document':
        return <FileText className="h-4 w-4 text-blue-500" />;
      case 'client':
        return <User className="h-4 w-4 text-green-500" />;
      case 'clientCode':
        return <User className="h-4 w-4 text-purple-500" />;
      case 'phone':
        return <Phone className="h-4 w-4 text-orange-500" />;
      case 'commercial':
        return <Building2 className="h-4 w-4 text-indigo-500" />;
    }
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          ref={inputRef}
          placeholder={placeholder}
          value={inputValue}
          onChange={handleInputChange}
          onFocus={() => inputValue.length > 0 && setIsOpen(true)}
          className="pl-10 pr-10 h-12 text-base"
        />
        {inputValue && (
          <button
            onClick={clearInput}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 p-1 hover:bg-gray-100 rounded-full"
          >
            <X className="h-4 w-4 text-gray-400" />
          </button>
        )}
      </div>

      {/* Suggestions Dropdown */}
      {isOpen && suggestions.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-80 overflow-auto">
          <div className="py-2">
            <div className="px-3 py-1 text-xs text-gray-500 uppercase font-semibold">
              {suggestions.length} suggestion{suggestions.length > 1 ? 's' : ''} trouvée{suggestions.length > 1 ? 's' : ''}
            </div>
            {suggestions.map((suggestion, index) => (
              <button
                key={`${suggestion.type}-${suggestion.value}-${index}`}
                onClick={() => handleSelect(suggestion)}
                className="w-full px-3 py-2 flex items-center gap-3 hover:bg-gray-50 transition-colors text-left"
              >
                <div className="p-1.5 bg-gray-100 rounded-lg">
                  {getIcon(suggestion.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-900 truncate">
                    {suggestion.label}
                  </div>
                  <div className="text-xs text-gray-500 truncate">
                    {suggestion.subLabel}
                  </div>
                </div>
                <div className="text-xs text-gray-400 capitalize">
                  {suggestion.type === 'clientCode' ? 'Code' : 
                   suggestion.type === 'document' ? 'Pièce' :
                   suggestion.type === 'commercial' ? 'Rep.' :
                   suggestion.type}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* No results message */}
      {isOpen && inputValue.length > 0 && suggestions.length === 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg">
          <div className="px-3 py-4 text-center text-gray-500">
            Aucun résultat pour "{inputValue}"
          </div>
        </div>
      )}
    </div>
  );
}
