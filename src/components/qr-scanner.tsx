"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Html5Qrcode } from 'html5-qrcode';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { LogIn, LogOut, Camera, CameraOff, Loader2, Upload, CheckCircle2, ScanLine } from 'lucide-react';
import { cn } from '@/lib/utils';
import jsQR from 'jsqr';

type ScanMode = 'entry' | 'exit';

export function QrScanner() {
  const [mode, setMode] = useState<ScanMode>('entry');
  const [isScanning, setIsScanning] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastScan, setLastScan] = useState('');
  const [lastResult, setLastResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const router = useRouter();

  const processQRCode = useCallback(async (decodedText: string) => {
    if (decodedText === lastScan || isProcessing) return;
    setLastScan(decodedText);
    setIsProcessing(true);
    setLastResult(null);

    try {
      const payload = JSON.parse(decodedText);
      const { bookingId, userId, seatId } = payload;
      if (!bookingId || !userId || !seatId) throw new Error('Invalid QR code');

      const endpoint = mode === 'entry' ? '/api/scanner/check-in' : '/api/scanner/check-out';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId, userId, seatId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to process');

      const msg = mode === 'entry'
        ? `Seat ${seatId} — checked in until ${new Date(data.occupiedUntil).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`
        : `Seat ${seatId} is now available`;

      setLastResult({ ok: true, msg });
      toast({ title: mode === 'entry' ? 'Checked In' : 'Checked Out', description: msg });
      if (mode === 'entry') setTimeout(() => router.push('/dashboard'), 2000);
      setTimeout(() => setLastScan(''), 3000);
    } catch (e: any) {
      const msg = e.message ?? 'Could not process QR code';
      setLastResult({ ok: false, msg });
      toast({ variant: 'destructive', title: 'Scan Error', description: msg });
      setLastScan('');
    } finally {
      setIsProcessing(false);
    }
  }, [mode, toast, lastScan, isProcessing, router]);

  const startScanning = async () => {
    try {
      const scanner = new Html5Qrcode('qr-reader');
      scannerRef.current = scanner;
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        (text) => processQRCode(text),
        () => {}
      );
      setIsScanning(true);
      setLastResult(null);
    } catch {
      toast({ variant: 'destructive', title: 'Camera Error', description: 'Could not access camera. Check permissions.' });
    }
  };

  const stopScanning = async () => {
    if (scannerRef.current) {
      try { await scannerRef.current.stop(); } catch {}
      scannerRef.current = null;
    }
    setIsScanning(false);
    setLastScan('');
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsProcessing(true);
    setLastResult(null);
    try {
      const img = new Image();
      const url = URL.createObjectURL(file);
      await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = () => rej(); img.src = url; });
      const canvas = document.createElement('canvas');
      canvas.width = img.width; canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas error');
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: 'dontInvert' });
      URL.revokeObjectURL(url);
      if (!code) throw new Error('No QR code found in image');
      await processQRCode(code.data);
    } catch (err: any) {
      const msg = err.message ?? 'Could not read QR code';
      setLastResult({ ok: false, msg });
      toast({ variant: 'destructive', title: 'Scan Error', description: msg });
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  useEffect(() => {
    return () => { scannerRef.current?.stop().catch(() => {}); };
  }, []);

  return (
    <div className="w-full max-w-sm mx-auto space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">QR Scanner</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Scan student QR codes for check-in / check-out</p>
      </div>

      {/* Mode toggle */}
      <div className="grid grid-cols-2 gap-2 p-1 rounded-lg bg-muted">
        {(['entry', 'exit'] as ScanMode[]).map((m) => (
          <button
            key={m}
            onClick={() => { if (!isScanning) setMode(m); }}
            disabled={isScanning}
            className={cn(
              'flex items-center justify-center gap-2 rounded-md py-2 text-sm font-medium transition-all',
              mode === m
                ? 'bg-background shadow-sm text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {m === 'entry' ? <LogIn className="h-4 w-4" /> : <LogOut className="h-4 w-4" />}
            {m === 'entry' ? 'Entry' : 'Exit'}
          </button>
        ))}
      </div>

      {/* Viewfinder */}
      <div className={cn(
        'relative rounded-xl overflow-hidden border-2 transition-colors',
        isScanning ? 'border-primary bg-black' : 'border-dashed border-muted-foreground/25 bg-muted/30'
      )}>
        <div id="qr-reader" className={cn('w-full', !isScanning && 'hidden')} style={{ border: 'none' }} />

        {!isScanning && (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="rounded-2xl border-2 border-dashed border-muted-foreground/30 p-6 mb-3">
              <ScanLine className="h-10 w-10 text-muted-foreground/50" />
            </div>
            <p className="text-sm text-muted-foreground">Start camera or upload image</p>
          </div>
        )}

        {isProcessing && (
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center">
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm font-medium">Processing…</p>
            </div>
          </div>
        )}
      </div>

      {/* Result banner */}
      {lastResult && (
        <div className={cn(
          'flex items-start gap-2.5 rounded-lg p-3 text-sm',
          lastResult.ok
            ? 'bg-green-500/10 border border-green-500/20 text-green-700 dark:text-green-400'
            : 'bg-destructive/10 border border-destructive/20 text-destructive'
        )}>
          <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{lastResult.msg}</span>
        </div>
      )}

      {/* Action buttons */}
      <div className="grid grid-cols-2 gap-2">
        <Button
          onClick={isScanning ? stopScanning : startScanning}
          variant={isScanning ? 'destructive' : 'default'}
          disabled={isProcessing}
          className="gap-2"
        >
          {isScanning
            ? <><CameraOff className="h-4 w-4" /> Stop</>
            : <><Camera className="h-4 w-4" /> Camera</>}
        </Button>
        <Button
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          disabled={isProcessing || isScanning}
          className="gap-2"
        >
          <Upload className="h-4 w-4" /> Upload
        </Button>
      </div>

      <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />

      {/* Mode hint */}
      <p className="text-xs text-center text-muted-foreground">
        {mode === 'entry' ? 'Entry mode — student checking in' : 'Exit mode — student checking out'}
      </p>
    </div>
  );
}
