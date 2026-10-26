import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

export default function Login() {
  const [ci, setCi] = useState('');
  const [clave, setClave] = useState('');
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

  const handleIngresar = async () => {
    if (cargando) return;

    if (!ci.trim()) return fail('Ingresa tu CI.');
    if (!clave.trim()) return fail('Ingresa tu contraseña.');

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
        fail(data.detail || 'Credenciales inválidas.');
        setClave('');
        return;
      }

      if (data.IsAdmin) {
        try {
          window.localStorage.setItem("blanquita_es_admin", "true");
        } catch {}
      } else {
        try {
          window.localStorage.removeItem("blanquita_es_admin");
        } catch {}
      }
      window.location.href = data.rutaRedirect || '/';
    } catch (err) {
      fail('No se pudo conectar con el servidor. Intenta nuevamente.');
      setClave('');
    } finally {
      setCargando(false);
    }
  };

  const handleTecla = (e) => {
    if (e.key === 'Enter') handleIngresar();
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-5 bg-gradient-to-br from-[#e3f4fb] via-[#f4f9fc] to-white font-sans text-[#123a4c]">
      <div className="w-full max-w-[400px] flex flex-col gap-[22px] animate-in fade-in slide-in-from-bottom-2 duration-300">
        <div className="flex flex-col items-center gap-[10px] text-center">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#1C96C5] to-[#20A7DB] flex items-center justify-center shadow-[0_8px_20px_rgba(28,150,197,0.3)]">
            <div className="w-[26px] h-[26px] rounded-full bg-white border-[7px] border-[#A0D9EF] box-border" />
          </div>
          <div className="flex flex-col gap-0.5">
            <div className="text-2xl font-extrabold text-[#1C96C5]">Papel Blanquita</div>
            <div className="text-[13px] font-semibold text-[#5d8299]">Sistema de Inventario y Producción</div>
          </div>
        </div>

        <div className="bg-white rounded-[18px] p-7 px-6 shadow-[0_4px_24px_rgba(18,58,76,0.1)] flex flex-col gap-5 box-border">
          <div className="flex flex-col gap-2">
            <Label
              htmlFor="ci"
              className="text-xs font-bold text-[#33566b] uppercase tracking-[0.6px]"
            >
              Carnet de identidad (CI)
            </Label>
            <Input
              id="ci"
              value={ci}
              onChange={handleCi}
              onKeyDown={handleTecla}
              inputMode="numeric"
              autoComplete="username"
              placeholder="Ej. 8456123"
              disabled={cargando}
              className="h-12 rounded-xl border-[1.5px] border-[#cfe2ee] px-3.5 text-base font-semibold text-[#123a4c] focus-visible:border-[#20A7DB] focus-visible:ring-[3px] focus-visible:ring-[#20A7DB]/20"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label className="text-xs font-bold text-[#33566b] uppercase tracking-[0.6px]">
              Contraseña
            </Label>
            <div className={shake ? 'animate-[shake_0.35s_ease]' : ''}>
              <Input
                type="password"
                value={clave}
                onChange={handleClave}
                onKeyDown={handleTecla}
                maxLength={30}
                autoComplete="off"
                disabled={cargando}
                placeholder="Ingresa tu contraseña"
                className="h-12 rounded-xl border-[1.5px] border-[#cfe2ee] px-3.5 text-base font-semibold text-[#123a4c] focus-visible:border-[#20A7DB] focus-visible:ring-[3px] focus-visible:ring-[#20A7DB]/20"
              />
            </div>
            {error && (
              <div className="text-[13px] font-semibold text-[#c0392b] bg-[#fdecea] rounded-lg px-3 py-2.5 text-center">
                {error}
              </div>
            )}
          </div>

          <Button
            onClick={handleIngresar}
            disabled={cargando}
            className="h-[50px] rounded-xl bg-gradient-to-r from-[#1C96C5] to-[#20A7DB] font-extrabold text-[15px] shadow-[0_4px_14px_rgba(28,150,197,0.35)] hover:brightness-[1.06]"
          >
            {cargando ? 'Ingresando...' : 'Ingresar'}
          </Button>
        </div>

        <div className="text-center text-xs text-[#8aa7b8]">
          ¿Olvidaste tu contraseña?{' '}
          <a href="#" className="text-[#1C96C5] font-bold no-underline">
            Contacta al administrador
          </a>
        </div>
      </div>
    </div>
  );
}