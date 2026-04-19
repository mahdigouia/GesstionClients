'use client';

import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, File, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

interface FileUploadProps {
  onFileSelect: (files: File[]) => void;
  isProcessing?: boolean;
  progress?: number;
}

export function FileUpload({ onFileSelect, isProcessing = false, progress = 0 }: FileUploadProps) {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setSelectedFiles(acceptedFiles);
      onFileSelect(acceptedFiles);
    }
  }, [onFileSelect]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'image/*': ['.png', '.jpg', '.jpeg', '.tiff']
    },
    maxFiles: 10,
    disabled: isProcessing
  });

  const clearFiles = () => {
    setSelectedFiles([]);
  };

  return (
    <Card className="w-full">
      <CardContent className="p-6">
        <div
          {...getRootProps()}
          className={`
            border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
            ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'}
            ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}
          `}
        >
          <input {...getInputProps()} />
          
          {isProcessing ? (
            <div className="space-y-4">
              <Loader2 className="mx-auto h-12 w-12 text-blue-500 animate-spin" />
              <p className="text-lg font-medium">Traitement en cours...</p>
              <Progress value={progress} className="w-full" />
              <p className="text-sm text-gray-600">{progress}% complété</p>
            </div>
          ) : selectedFiles.length > 0 ? (
            <div className="space-y-4">
              <File className="mx-auto h-12 w-12 text-green-500" />
              <div>
                <p className="font-medium">{selectedFiles.length} fichier(s) sélectionné(s)</p>
                <div className="text-sm text-gray-500 space-y-1 max-h-32 overflow-y-auto">
                  {selectedFiles.map((file, index) => (
                    <div key={index}>
                      {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex justify-center space-x-2">
                <Button
                  onClick={(e) => {
                    e.stopPropagation();
                    onFileSelect(selectedFiles);
                  }}
                  size="sm"
                >
                  Traiter les fichiers
                </Button>
                <Button
                  onClick={(e) => {
                    e.stopPropagation();
                    clearFiles();
                  }}
                  variant="outline"
                  size="sm"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <Upload className="mx-auto h-12 w-12 text-gray-400" />
              <div>
                <p className="text-lg font-medium">
                  {isDragActive ? 'Déposez les fichiers ici' : 'Glissez-déposez les fichiers ici'}
                </p>
                <p className="text-sm text-gray-500">
                  ou cliquez pour sélectionner les fichiers
                </p>
              </div>
              <div className="text-xs text-gray-400">
                Formats supportés: PDF, PNG, JPG, JPEG, TIFF (jusqu'à 10 fichiers)
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
