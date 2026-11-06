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
    <div className="min-h-screen w-full flex flex-col items-center justify-center p-4 bg-gradient-to-b from-sky-50/60 via-slate-50 to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 text-slate-800 dark:text-slate-100 font-sans selection:bg-[#20A7DB]/20 selection:text-[#188cba] relative overflow-hidden">
      {/* Halos decorativos de fondo con el celeste corporativo de Blanquita */}
      <div className="absolute -top-32 -left-32 w-80 h-80 bg-[#20A7DB]/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-80 h-80 bg-[#20A7DB]/10 rounded-full blur-3xl pointer-events-none" />

      {/* Contenedor Central */}
      <div className="w-full max-w-[390px] flex flex-col gap-6 animate-in fade-in duration-300 relative z-10">
        
        {/* Identidad de Marca y Logo Oficial */}
        <div className="flex flex-col items-center text-center">
          <div className="p-3 bg-white dark:bg-slate-900 rounded-2xl border border-sky-100 dark:border-slate-800 shadow-sm shadow-[#20A7DB]/10 mb-4 transition-transform hover:scale-105 duration-200">
            <img 
              src="/LogoBlanquita.webp" 
              alt="Papel Blanquita" 
              className="h-14 w-auto object-contain"
              loading="eager"
            />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
            Papelera Blanquita
          </h1>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1">
            Sistema Integral de Gestión y Control
          </p>
        </div>

        {/* Tarjeta de Inicio de Sesión */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-6 sm:p-7 shadow-lg shadow-slate-200/50 dark:shadow-none relative overflow-hidden">
          {/* Línea superior con gradiente corporativo */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#20A7DB] via-[#52c2ed] to-[#20A7DB]" />

          <form onSubmit={handleIngresar} className="flex flex-col gap-4">
            
            {/* Campo CI */}
            <div className="space-y-1.5">
              <Label 
                htmlFor="ci" 
                className="text-[11px] font-semibold tracking-wider uppercase text-slate-600 dark:text-slate-400"
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
                className="h-10 text-sm font-medium rounded-lg border-slate-200 dark:border-slate-800 focus-visible:ring-2 focus-visible:ring-[#20A7DB] focus-visible:border-[#20A7DB] transition-all"
              />
            </div>

            {/* Campo Contraseña */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label 
                  htmlFor="clave" 
                  className="text-[11px] font-semibold tracking-wider uppercase text-slate-600 dark:text-slate-400"
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
                  className="h-10 pr-10 text-sm font-medium rounded-lg border-slate-200 dark:border-slate-800 focus-visible:ring-2 focus-visible:ring-[#20A7DB] focus-visible:border-[#20A7DB] transition-all"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setMostrarClave(!mostrarClave)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#20A7DB] dark:hover:text-[#20A7DB] transition-colors"
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
              <div className="p-3 text-xs font-medium text-rose-700 bg-rose-50 dark:bg-rose-950/40 dark:text-rose-300 rounded-lg border border-rose-200/70 dark:border-rose-900/50 text-center animate-in fade-in duration-200">
                {error}
              </div>
            )}

            {/* Botón de Ingreso con el Celeste de la Interfaz (#20A7DB) */}
            <Button
              type="submit"
              disabled={cargando}
              className="h-10 mt-2 bg-[#20A7DB] hover:bg-[#188cba] active:bg-[#1579a1] text-white text-xs font-bold rounded-lg shadow-sm hover:shadow-md hover:shadow-[#20A7DB]/25 transition-all flex items-center justify-center gap-2 cursor-pointer"
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
        <div className="flex flex-col items-center gap-1.5 text-center">
          <div className="inline-flex items-center gap-1.5 text-[11px] text-slate-500">
            <ShieldCheck className="h-3.5 w-3.5 text-[#20A7DB]" />
            <span>Shema Asociados S.R.L. · Acceso Restringido</span>
          </div>
          <span className="text-[10px] text-slate-400">
            Versión 2.0 Enterprise
          </span>
        </div>

      </div>
    </div>
  );
}
