import React from "react";
import { AlertCircle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export class PanelErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error(`[PanelErrorBoundary] Error capturado en panel ${this.props.titulo || ""}:`, error, errorInfo);
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <div className="p-4 sm:p-6 bg-rose-50 border border-rose-200 rounded-lg text-center my-2">
          <div className="flex items-center justify-center gap-2 text-rose-700 font-semibold mb-2">
            <AlertCircle className="w-5 h-5 text-rose-600" />
            <span>Algo salió mal al cargar este panel{this.props.titulo ? ` (${this.props.titulo})` : ""}</span>
          </div>
          <p className="text-xs text-rose-600 mb-4 max-w-md mx-auto">
            {this.state.error?.message || "Ocurrió un error inesperado al renderizar esta sección."}
          </p>
          <div className="flex items-center justify-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={this.handleReset}
              className="bg-white hover:bg-rose-100 text-rose-700 border-rose-300 gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reintentar
            </Button>
            {this.props.onClose && (
              <Button
                variant="ghost"
                size="sm"
                onClick={this.props.onClose}
                className="text-slate-600"
              >
                Cerrar
              </Button>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default PanelErrorBoundary;
