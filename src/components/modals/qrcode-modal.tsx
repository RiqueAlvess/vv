'use client';

import { useRef, useCallback, useState } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Download, Printer, Copy, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';

// High-resolution off-screen QR source used for all downloads/print.
// Rendering the QR directly on a <canvas> at the final pixel size guarantees
// crisp modules with no rasterization artifacts (no "hole" in the middle).
const QR_HI_RES = 1024;

interface QRCodeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  surveyUrl: string;
  campaignName: string;
  campaignStartDate?: string;
  campaignEndDate?: string;
  companyName?: string;
  companyLogoUrl?: string;
}

// Brand colors
const NAVY  = '#144660';
const GREEN = '#1ff28d';
const GRAY  = '#ebf0eb';
const MUTED = '#6B7280';
const LIGHT = '#9CA3AF';

export function QRCodeModal({
  open,
  onOpenChange,
  surveyUrl,
  campaignName,
  campaignStartDate,
  campaignEndDate,
  companyName,
  companyLogoUrl,
}: QRCodeModalProps) {
  const [copied, setCopied] = useState(false);
  const [generatingCard, setGeneratingCard] = useState(false);
  // Hidden container holding the high-res source canvas used by every
  // download/print path. Kept completely separate from the visible preview
  // so neither layout changes nor CSS accidentally affect the pixel buffer.
  const qrRef = useRef<HTMLDivElement>(null);

  const handleCopyLink = useCallback(async () => {
    await navigator.clipboard.writeText(surveyUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [surveyUrl]);

  const handleDownloadQr = useCallback(() => {
    if (!qrRef.current) return;
    const sourceCanvas = qrRef.current.querySelector('canvas');
    if (!sourceCanvas) return;

    // Re-render onto a clean canvas with a guaranteed white background.
    // The hi-res source canvas already has one, but this protects against
    // any future changes that make the source transparent.
    const size = QR_HI_RES;
    const out = document.createElement('canvas');
    out.width = size;
    out.height = size;
    const ctx = out.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, size, size);
    ctx.drawImage(sourceCanvas, 0, 0, size, size);

    const link = document.createElement('a');
    link.download = `qrcode-${campaignName.replace(/\s+/g, '-').toLowerCase()}.png`;
    link.href = out.toDataURL('image/png');
    link.click();
  }, [campaignName]);

  const handlePrint = useCallback(() => {
    if (!qrRef.current) return;
    const canvasEl = qrRef.current.querySelector('canvas');
    if (!canvasEl) return;

    // Use the high-res canvas directly to guarantee a crisp, complete QR.
    const dataUrl = canvasEl.toDataURL('image/png');

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>QR Code — ${campaignName}</title>
          <style>
            @media print { @page { margin: 0; } }
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body { font-family: Arial, sans-serif; background: #fff; }
            .header { background: ${NAVY}; width: 100%; padding: 24px 40px 20px; }
            .logo { font-size: 32px; font-weight: 800; letter-spacing: -1px; }
            .logo-main { color: #fff; }
            .logo-360 { color: ${GREEN}; }
            .subtitle { color: rgba(255,255,255,0.65); font-size: 13px; margin-top: 4px; }
            .body { padding: 32px 40px; display: flex; flex-direction: column; align-items: center; }
            h2 { font-size: 17px; color: ${NAVY}; margin: 0 0 4px; text-align: center; }
            p { font-size: 12px; color: ${MUTED}; margin: 4px 0; word-break: break-all; max-width: 300px; text-align: center; }
            img.qr { width: 300px; height: 300px; image-rendering: pixelated; }
            .accent-bar { height: 4px; background: ${GREEN}; width: 100%; }
            .footer { background: ${NAVY}; width: 100%; padding: 12px; text-align: center;
                      font-size: 11px; color: rgba(255,255,255,0.5); }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="logo">
              <span class="logo-main">Vivamente</span><span class="logo-360">360</span>
            </div>
            <div class="subtitle">Mapeamento de Riscos Psicossociais</div>
          </div>
          <div class="body">
            <h2>${campaignName}</h2>
            <p style="margin-bottom:16px;color:${MUTED}">Escaneie o QR Code para participar</p>
            <img class="qr" src="${dataUrl}" alt="QR Code" />
            <p style="margin-top:16px;color:${LIGHT};">${surveyUrl}</p>
          </div>
          <div class="accent-bar"></div>
          <div class="footer">Vivamente360 — Plataforma de Riscos Psicossociais NR-1</div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    printWindow.close();
  }, [campaignName, surveyUrl]);

  const handleDownloadCard = useCallback(async () => {
    if (!qrRef.current) return;
    setGeneratingCard(true);

    try {
      const W = 800;
      const H = 1000;
      const canvas = document.createElement('canvas');
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Robust image loader: fetch → Blob → object URL. This bypasses all
      // crossOrigin / canvas-taint issues for same-origin assets (bg.jpeg,
      // /logo.png) and works for any cross-origin asset whose host sends
      // CORS headers (Supabase storage). Falls back to a plain Image load
      // only as a last resort.
      const loadImg = async (src: string): Promise<HTMLImageElement | null> => {
        const fromObjectUrl = async (): Promise<HTMLImageElement | null> => {
          try {
            const res = await fetch(src, { cache: 'no-store' });
            if (!res.ok) return null;
            const blob = await res.blob();
            const objUrl = URL.createObjectURL(blob);
            return await new Promise<HTMLImageElement | null>((resolve) => {
              const img = new Image();
              img.onload = () => {
                URL.revokeObjectURL(objUrl);
                resolve(img);
              };
              img.onerror = () => {
                URL.revokeObjectURL(objUrl);
                resolve(null);
              };
              img.src = objUrl;
            });
          } catch {
            return null;
          }
        };
        const fromDirect = (): Promise<HTMLImageElement | null> =>
          new Promise((resolve) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => resolve(img);
            img.onerror = () => resolve(null);
            img.src = src;
          });
        return (await fromObjectUrl()) ?? (await fromDirect());
      };

      // ── 1. Background ────────────────────────────────────────────────
      const bgImg = await loadImg('/bg.jpeg');
      if (bgImg) {
        const imgAR = bgImg.width / bgImg.height;
        const canAR = W / H;
        let sx = 0, sy = 0, sw = bgImg.width, sh = bgImg.height;
        if (imgAR > canAR) {
          sw = bgImg.height * canAR;
          sx = (bgImg.width - sw) / 2;
        } else {
          sh = bgImg.width / canAR;
          sy = (bgImg.height - sh) / 2;
        }
        ctx.drawImage(bgImg, sx, sy, sw, sh, 0, 0, W, H);
      } else {
        ctx.fillStyle = '#0D3D4F';
        ctx.fillRect(0, 0, W, H);
      }

      // ── 2. Dark gradient overlay ─────────────────────────────────────
      const grad = ctx.createLinearGradient(0, 0, W, H);
      grad.addColorStop(0, 'rgba(13,61,79,0.82)');
      grad.addColorStop(0.5, 'rgba(13,61,79,0.68)');
      grad.addColorStop(1, 'rgba(26,46,53,0.60)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);

      // ── 3. "Vivamente" (white) + "360" (green) title ─────────────────
      ctx.textBaseline = 'alphabetic';
      ctx.font = '900 72px Arial, sans-serif';
      const vivText = 'Vivamente';
      const num360 = '360';
      const vivW = ctx.measureText(vivText).width;
      const num360W = ctx.measureText(num360).width;
      const titleStartX = (W - vivW - num360W) / 2;
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(vivText, titleStartX, 120);
      ctx.fillStyle = '#1AA278';
      ctx.fillText(num360, titleStartX + vivW, 120);

      // ── 4. Subtitle ──────────────────────────────────────────────────
      ctx.textAlign = 'center';
      ctx.font = '26px Arial, sans-serif';
      ctx.fillStyle = '#1AA278';
      ctx.fillText('Mapeamento Psicossocial:', W / 2, 158);

      // ── 5. White rounded box ─────────────────────────────────────────
      const BOX_W = 400;
      const BOX_H = 400;
      const BOX_X = (W - BOX_W) / 2;
      const BOX_Y = 185;
      const R = 20;
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.moveTo(BOX_X + R, BOX_Y);
      ctx.lineTo(BOX_X + BOX_W - R, BOX_Y);
      ctx.arcTo(BOX_X + BOX_W, BOX_Y, BOX_X + BOX_W, BOX_Y + R, R);
      ctx.lineTo(BOX_X + BOX_W, BOX_Y + BOX_H - R);
      ctx.arcTo(BOX_X + BOX_W, BOX_Y + BOX_H, BOX_X + BOX_W - R, BOX_Y + BOX_H, R);
      ctx.lineTo(BOX_X + R, BOX_Y + BOX_H);
      ctx.arcTo(BOX_X, BOX_Y + BOX_H, BOX_X, BOX_Y + BOX_H - R, R);
      ctx.lineTo(BOX_X, BOX_Y + R);
      ctx.arcTo(BOX_X, BOX_Y, BOX_X + R, BOX_Y, R);
      ctx.closePath();
      ctx.fill();

      // ── 6. QR code ───────────────────────────────────────────────────
      // Draw from the off-screen hi-res <canvas> (pixel-perfect, no SVG
      // rasterization artifacts, guaranteed complete — no "hole in the
      // middle"). The source canvas is already rendered with a white
      // background so nothing from the underlying card bleeds through.
      // High-quality smoothing gives a cleaner 1024→360 downscale than
      // nearest-neighbor for this non-integer ratio.
      const qrCanvas = qrRef.current.querySelector('canvas');
      const QR_SIZE = 360;
      if (qrCanvas) {
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(qrCanvas, BOX_X + 20, BOX_Y + 20, QR_SIZE, QR_SIZE);
      }

      // ── 7. Company / campaign name ───────────────────────────────────
      const textY = BOX_Y + BOX_H + 58;
      ctx.textAlign = 'center';
      ctx.font = 'bold 36px Arial, sans-serif';
      ctx.fillStyle = '#FFFFFF';
      let displayName = (companyName || campaignName).toUpperCase();
      // Truncate if too wide for canvas
      while (ctx.measureText(displayName).width > W - 80 && displayName.length > 8) {
        displayName = displayName.slice(0, -4) + '...';
      }
      ctx.fillText(displayName, W / 2, textY);

      // ── 8. "CAMPANHA:" label ─────────────────────────────────────────
      ctx.font = '20px Arial, sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.70)';
      ctx.fillText('CAMPANHA:', W / 2, textY + 46);

      // ── 9. Date range ────────────────────────────────────────────────
      const startStr = campaignStartDate
        ? format(new Date(campaignStartDate), 'dd/MM/yyyy')
        : '—';
      const endStr = campaignEndDate
        ? format(new Date(campaignEndDate), 'dd/MM/yyyy')
        : '—';
      ctx.font = 'bold 32px Arial, sans-serif';
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(`${startStr} – ${endStr}`, W / 2, textY + 88);

      // ── 10. Bottom logos ─────────────────────────────────────────────
      const LOGO_H = 48;
      const LOGO_Y = 880;
      const astaLogoUrl = process.env.NEXT_PUBLIC_LOGO_URL || '/logo.png';
      const [astaImg, compImg] = await Promise.all([
        loadImg(astaLogoUrl),
        companyLogoUrl ? loadImg(companyLogoUrl) : Promise.resolve(null),
      ]);

      if (astaImg && compImg) {
        const astaW = Math.round(astaImg.width * (LOGO_H / astaImg.height));
        const compW = Math.round(compImg.width * (LOGO_H / compImg.height));
        const GAP = 32;
        const midX = W / 2;
        // Vertical divider
        ctx.strokeStyle = 'rgba(255,255,255,0.30)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(midX, LOGO_Y - 8);
        ctx.lineTo(midX, LOGO_Y + LOGO_H + 8);
        ctx.stroke();
        // Asta logo right-aligned to center
        ctx.drawImage(astaImg, midX - GAP - astaW, LOGO_Y, astaW, LOGO_H);
        // Company logo left-aligned from center
        ctx.drawImage(compImg, midX + GAP, LOGO_Y, compW, LOGO_H);
      } else if (astaImg) {
        const astaW = Math.round(astaImg.width * (LOGO_H / astaImg.height));
        ctx.drawImage(astaImg, (W - astaW) / 2, LOGO_Y, astaW, LOGO_H);
      }

      // ── 11. Download ─────────────────────────────────────────────────
      const link = document.createElement('a');
      link.download = `card-${campaignName.replace(/\s+/g, '-').toLowerCase()}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } finally {
      setGeneratingCard(false);
    }
  }, [campaignName, campaignStartDate, campaignEndDate, companyName, companyLogoUrl]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm max-w-[calc(100vw-2rem)]">
        <DialogHeader>
          <DialogTitle>Acesso à Pesquisa</DialogTitle>
          <DialogDescription>{campaignName}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-5 py-1">
          {/* Visible preview — dedicated 220px canvas. Completely isolated
              from the hidden hi-res source below so layout/CSS tweaks on
              either one never affect the other. */}
          <div className="p-5 bg-white rounded-2xl shadow-lg border border-gray-100 flex flex-col items-center gap-3 w-full">
            <QRCodeCanvas
              value={surveyUrl}
              size={220}
              level="H"
              marginSize={0}
              bgColor="#FFFFFF"
              fgColor="#000000"
            />
            <div className="flex items-center gap-1">
              <span className="text-xs font-bold" style={{ color: NAVY }}>Vivamente</span>
              <span className="text-xs font-bold" style={{ color: '#16a34a' }}>360</span>
            </div>
          </div>

          {/* Hidden hi-res source used by every download / print path.
              Renders a pristine 1024×1024 canvas — no logo, no image
              overlay, no SVG rasterization step — so the QR is always
              pixel-perfect and complete (no "hole in the middle"). */}
          <div
            ref={qrRef}
            aria-hidden
            style={{
              position: 'absolute',
              left: -99999,
              top: -99999,
              width: 1,
              height: 1,
              overflow: 'hidden',
              pointerEvents: 'none',
            }}
          >
            <QRCodeCanvas
              value={surveyUrl}
              size={QR_HI_RES}
              level="H"
              marginSize={0}
              bgColor="#FFFFFF"
              fgColor="#000000"
            />
          </div>

          {/* Link field + copy button */}
          <div className="w-full space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">Link Curto</p>
            <div className="flex gap-2">
              <Input
                readOnly
                value={surveyUrl}
                className="text-xs h-9 select-all"
                onClick={(e) => (e.target as HTMLInputElement).select()}
              />
              <Button
                size="sm"
                variant="outline"
                onClick={handleCopyLink}
                className="shrink-0 h-9 px-3 gap-1.5 transition-all hover:bg-[#1ff28d] hover:text-[#144660] hover:border-[#1ff28d] hover:shadow-md"
              >
                {copied
                  ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                  : <Copy className="h-3.5 w-3.5" />}
                <span className="text-xs">{copied ? 'Copiado' : 'Copiar'}</span>
              </Button>
            </div>
          </div>

          {/* Primary — download QR */}
          <Button
            className="w-full h-11 text-sm font-semibold text-white gap-2 bg-[#22c55e] transition-all hover:bg-[#16a34a] hover:shadow-lg hover:-translate-y-0.5"
            onClick={handleDownloadQr}
          >
            <Download className="h-4 w-4" />
            Baixar QR Code
          </Button>

          {/* Secondary — print + card */}
          <div className="flex gap-2 w-full">
            <Button
              variant="outline"
              className="flex-1 h-9 text-sm gap-2 transition-all hover:bg-[#1ff28d] hover:text-[#144660] hover:border-[#1ff28d] hover:shadow-md hover:-translate-y-0.5"
              onClick={handlePrint}
            >
              <Printer className="h-4 w-4" />
              Imprimir
            </Button>
            <Button
              variant="outline"
              className="flex-1 h-9 text-sm gap-2 transition-all hover:bg-[#1ff28d] hover:text-[#144660] hover:border-[#1ff28d] hover:shadow-md hover:-translate-y-0.5"
              onClick={handleDownloadCard}
              disabled={generatingCard}
            >
              <Download className="h-4 w-4" />
              {generatingCard ? 'Gerando...' : 'Baixar Card de Divulgação'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
