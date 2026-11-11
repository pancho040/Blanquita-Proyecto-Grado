import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Lock, Eye, EyeOff, ShieldCheck, ArrowRight, Loader2 } from 'lucide-react';

export default function Login() {
  const [ci, setCi] = useState('');
  const [clave, setClave] = useState('');
  const [mostrarClave, setMostrarClave] = useState(false);
  const [error, setError] = useState('');
  const [shake, setShake] = useState(false);
  const [cargando, setCargando] = useState(false);

  const fail = (msg) => {
    setError(msg);
    setShake(true);
    setTimeout(() => setShake(false), 400);
  };

  const handleCi = (e) => {
    setCi(e.target.value.replace(/\D/g, ''));
  };

  const handleClave = (e) => {
    setClave(e.target.value.slice(0, 30));
  };

  const handleIngresar = async (e) => {
    if (e) e.preventDefault();
    if (cargando) return;

    if (!ci.trim()) return fail('Ingresa tu número de Carnet de Identidad (CI).');
    if (!clave.trim()) return fail('Ingresa tu contraseña de acceso.');

    setCargando(true);
    setError('');

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ Ci: ci.trim(), Clave: clave }),
      });

      const data = await response.json();

      if (!response.ok) {
        fail(data.detail || 'Credenciales de acceso no válidas.');
        setClave('');
        return;
      }

      if (data.IsAdmin) {
        try {
          window.localStorage.setItem('blanquita_es_admin', 'true');
        } catch {}
      } else {
        try {
          window.localStorage.removeItem('blanquita_es_admin');
        } catch {}
      }
      window.location.href = data.rutaRedirect || '/';
    } catch (err) {
      fail('Error de comunicación con el servidor. Intenta de nuevo.');
      setClave('');
    } finally {
      setCargando(false);
    }
  };

  const handleTecla = (e) => {
    if (e.key === 'Enter') handleIngresar();
  };

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center p-4 bg-[#F8FAFC] text-slate-900 font-sans selection:bg-[#1C96C5]/20 selection:text-[#157A9E] relative">
      {/* Contenedor Central */}
      <div className="w-full max-w-[380px] flex flex-col gap-5 relative z-10">
        
        {/* Identidad de Marca y Logo Oficial */}
        <div className="flex flex-col items-center text-center">
          <div className="p-2.5 bg-white rounded border border-slate-200 mb-3">
            <img 
              src="/LogoBlanquita.webp" 
              alt="Papel Blanquita" 
              className="h-12 w-auto object-contain"
              loading="eager"
            />
          </div>
          <h1 className="text-lg font-bold tracking-tight text-slate-900">
            Papelera Blanquita
          </h1>
          <p className="text-xs font-medium text-slate-500 mt-0.5">
            Sistema Integral de Gestión y Control ERP
          </p>
        </div>

        {/* Tarjeta de Inicio de Sesión */}
        <div className="bg-white rounded border border-slate-200 p-6 shadow-xs relative">
          <form onSubmit={handleIngresar} className="flex flex-col gap-4">
            
            {/* Campo CI */}
            <div className="space-y-1.5">
              <Label 
                htmlFor="ci" 
                className="text-xs font-semibold tracking-wider uppercase text-slate-600"
              >
                Carnet de Identidad (CI)
              </Label>
              <Input
                id="ci"
                type="text"
                value={ci}
                onChange={handleCi}
                onKeyDown={handleTecla}
                inputMode="numeric"
                autoComplete="username"
                placeholder="Ej. 10000001"
                disabled={cargando}
                className="h-9 text-xs font-medium rounded border-slate-300 focus-visible:ring-1 focus-visible:ring-slate-900 focus-visible:border-slate-900"
              />
            </div>

            {/* Campo Contraseña */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label 
                  htmlFor="clave" 
                  className="text-xs font-semibold tracking-wider uppercase text-slate-600"
                >
                  Contraseña
                </Label>
              </div>
              <div className={`relative ${shake ? 'animate-shake' : ''}`}>
                <Input
                  id="clave"
                  type={mostrarClave ? 'text' : 'password'}
                  value={clave}
                  onChange={handleClave}
                  onKeyDown={handleTecla}
                  maxLength={30}
                  autoComplete="current-password"
                  disabled={cargando}
                  placeholder="••••••••••••"
                  className="h-9 pr-9 text-xs font-medium rounded border-slate-300 focus-visible:ring-1 focus-visible:ring-slate-900 focus-visible:border-slate-900"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setMostrarClave(!mostrarClave)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
                >
                  {mostrarClave ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Alerta de Error Minimalista */}
            {error && (
              <div className="p-2.5 text-xs font-medium text-red-700 bg-red-50 rounded border border-red-200 text-center">
                {error}
              </div>
            )}

            {/* Botón de Ingreso con el Azul Corporativo Oficial (#1C96C5) */}
            <Button
              type="submit"
              disabled={cargando}
              className="h-9 mt-1 bg-[#1C96C5] hover:bg-[#157A9E] active:bg-[#126b8b] text-white text-xs font-semibold rounded transition-colors flex items-center justify-center gap-2 cursor-pointer border border-transparent shadow-none"
            >
              {cargando ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin text-white" />
                  <span>Validando credenciales...</span>
                </>
              ) : (
                <>
                  <span>Iniciar Sesión</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </>
              )}
            </Button>
          </form>
        </div>

        {/* Footer Corporativo Sobrio */}
        <div className="flex flex-col items-center gap-1 text-center">
          <div className="inline-flex items-center gap-1.5 text-xs text-slate-500">
            <ShieldCheck className="h-3.5 w-3.5 text-[#1C96C5]" />
            <span>Shema Asociados S.R.L. · Acceso Restringido</span>
          </div>
          <span className="text-[11px] text-slate-400 font-mono">
            Versión 2.0 Enterprise
          </span>
        </div>

      </div>
    </div>
  );
}
