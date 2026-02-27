import { useEffect, useState } from 'react';
import { api } from '@/utils/apiClient';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Bot } from "lucide-react";

interface Model {
  id: number;
  name: string;
  deployment_name: string;
  provider: string;
  provider_type: string;
  description?: string;
  is_default: boolean;
  streaming: boolean;
  temperature?: number;
}

interface ModelSelectorProps {
  onModelChange?: (modelId: number, model: Model) => void;
  className?: string;
}

export function ModelSelector({ onModelChange, className }: ModelSelectorProps) {
  const [models, setModels] = useState<Model[]>([]);
  const [selectedModelId, setSelectedModelId] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchModels();
  }, []);

  const fetchModels = async () => {
    try {
      const data = await api.get<any>('/admin/models/api/available');

      if (data.status === 'success' && data.models) {
        setModels(data.models);

        // Set default model or first model
        const defaultId = data.default_model_id?.toString() || data.models[0]?.id?.toString();
        if (defaultId) {
          setSelectedModelId(defaultId);

          // Load saved model from localStorage or use default
          const savedModelId = localStorage.getItem('smartlib_selected_model');
          if (savedModelId && data.models.some((m: Model) => m.id.toString() === savedModelId)) {
            setSelectedModelId(savedModelId);
          }
        }
      }
    } catch (error) {
      console.error('Failed to fetch models:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleModelChange = (modelId: string) => {
    setSelectedModelId(modelId);
    localStorage.setItem('smartlib_selected_model', modelId);

    const model = models.find(m => m.id.toString() === modelId);
    if (model && onModelChange) {
      onModelChange(parseInt(modelId), model);
    }
  };

  const selectedModel = models.find(m => m.id.toString() === selectedModelId);

  if (loading || models.length === 0) {
    return null;
  }

  return (
    <div className={`flex items-center gap-2 ${className || ''}`}>
      {/* Removed the "Model:" label as per compact look */}

      <Select value={selectedModelId} onValueChange={handleModelChange}>
        <SelectTrigger className="w-auto h-6 gap-1 px-2 text-[10px] bg-muted/50 border-transparent hover:bg-muted focus:ring-0 focus:ring-offset-0 transition-colors rounded-full">
          <Bot className="h-4 w-4 text-muted-foreground/70" />
          <SelectValue placeholder="Select a model">
            {selectedModel && (
              <span className="font-bold text-muted-foreground truncate max-w-[100px]">
                {selectedModel.name}
                {selectedModel.provider && ` (${selectedModel.provider})`}
              </span>
            )}
          </SelectValue>
        </SelectTrigger>

        <SelectContent className="max-w-[400px]">
          {models.map((model) => (
            <SelectItem key={model.id} value={model.id.toString()} className="text-xs">
              <div className="flex flex-col py-0.5">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{model.name}</span>
                  {model.is_default && (
                    <span className="px-1.5 py-0.5 text-[10px] font-medium bg-primary/10 text-primary rounded">
                      Default
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-0.5 text-[11px] text-muted-foreground">
                  <span>{model.provider}</span>
                  {model.streaming && <span>• Streaming</span>}
                  {model.temperature !== null && model.temperature !== undefined && (
                    <span>• Temp: {model.temperature}</span>
                  )}
                </div>
                {model.description && (
                  <span className="mt-1 text-[11px] text-muted-foreground line-clamp-2">
                    {model.description}
                  </span>
                )}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
