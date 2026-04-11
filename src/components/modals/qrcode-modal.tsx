'use client';

import { useRef, useCallback, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Download, Printer, Copy, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';

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

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

/** Loads an image via Promise; resolves null on error or timeout */
function loadImg(src: string, timeoutMs = 8000): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    const timer = window.setTimeout(() => resolve(null), timeoutMs);
    img.onload  = () => { clearTimeout(timer); resolve(img); };
    img.onerror = () => { clearTimeout(timer); resolve(null); };
    img.src = src;
  });
}

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
  const qrRef = useRef<HTMLDivElement>(null);

  const handleCopyLink = useCallback(async () => {
    await navigator.clipboard.writeText(surveyUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [surveyUrl]);

  const handleDownloadQr = useCallback(() => {
    if (!qrRef.current) return;
    const svgEl = qrRef.current.querySelector('svg');
    if (!svgEl) return;

    const canvas = document.createElement('canvas');
    const size = 512;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, size, size);

    const svgData = new XMLSerializer().serializeToString(svgEl);
    const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 0, 0, size, size);
      URL.revokeObjectURL(url);
      const link = document.createElement('a');
      link.download = `qrcode-${campaignName.replace(/\s+/g, '-').toLowerCase()}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    };
    img.src = url;
  }, [campaignName]);

  const handlePrint = useCallback(() => {
    if (!qrRef.current) return;
    const svgEl = qrRef.current.querySelector('svg');
    if (!svgEl) return;

    const svgClone = svgEl.cloneNode(true) as SVGElement;
    svgClone.setAttribute('width', '300');
    svgClone.setAttribute('height', '300');

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
            p { font-size: 12px; color: #6B7280; margin: 4px 0; word-break: break-all; max-width: 300px; text-align: center; }
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
            <p style="margin-bottom:16px">Escaneie o QR Code para participar</p>
            ${svgClone.outerHTML}
            <p style="margin-top:16px;color:#9CA3AF">${surveyUrl}</p>
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
    const svgEl = qrRef.current.querySelector('svg');
    if (!svgEl) return;

    // Snapshot SVG synchronously before any async operations
    const QR_SIZE = 360;
    const svgClone = svgEl.cloneNode(true) as SVGElement;
    svgClone.setAttribute('width', String(QR_SIZE));
    svgClone.setAttribute('height', String(QR_SIZE));
    const svgData = new XMLSerializer().serializeToString(svgClone);
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const svgBlobUrl = URL.createObjectURL(svgBlob);

    setGeneratingCard(true);
    try {
      const W = 800, H = 1000;
      const canvas = document.createElement('canvas');
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Load all images in parallel (QR + background + logos)
      const astaLogoSrc = (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_LOGO_URL) || '/logo.png';
      const [bgImg, qrImg, astaImg, compImg] = await Promise.all([
        loadImg('/bg.jpeg'),
        loadImg(svgBlobUrl),
        loadImg(astaLogoSrc),
        companyLogoUrl ? loadImg(companyLogoUrl) : Promise.resolve(null),
      ]);
      URL.revokeObjectURL(svgBlobUrl);

      // ── 1. Background photo ──────────────────────────────────────────
      if (bgImg) {
        const imgAR = bgImg.width / bgImg.height;
        const canAR = W / H;
        let sx = 0, sy = 0, sw = bgImg.width, sh = bgImg.height;
        if (imgAR > canAR) { sw = bgImg.height * canAR; sx = (bgImg.width - sw) / 2; }
        else { sh = bgImg.width / canAR; sy = (bgImg.height - sh) / 2; }
        ctx.drawImage(bgImg, sx, sy, sw, sh, 0, 0, W, H);
      } else {
        ctx.fillStyle = '#0D3D4F';
        ctx.fillRect(0, 0, W, H);
      }

      // ── 2. Dark gradient overlay ─────────────────────────────────────
      const grad = ctx.createLinearGradient(0, 0, W, H);
      grad.addColorStop(0,   'rgba(13,61,79,0.82)');
      grad.addColorStop(0.5, 'rgba(13,61,79,0.68)');
      grad.addColorStop(1,   'rgba(26,46,53,0.60)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);

      // ── 3. "Vivamente" (white) + "360" (green) title ─────────────────
      ctx.textBaseline = 'alphabetic';
      ctx.font = '900 72px Arial, sans-serif';
      const vivText = 'Vivamente';
      const num360  = '360';
      const vivTextW = ctx.measureText(vivText).width;
      const num360W  = ctx.measureText(num360).width;
      const titleX   = (W - vivTextW - num360W) / 2;
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(vivText, titleX, 120);
      ctx.fillStyle = GREEN;
      ctx.fillText(num360, titleX + vivTextW, 120);

      // ── 4. Subtitle ──────────────────────────────────────────────────
      ctx.textAlign = 'center';
      ctx.font = '26px Arial, sans-serif';
      ctx.fillStyle = GREEN;
      ctx.fillText('Mapeamento Psicossocial:', W / 2, 158);

      // ── 5. White rounded box ─────────────────────────────────────────
      const BOX_W = 400, BOX_H = 400;
      const BOX_X = (W - BOX_W) / 2;
      const BOX_Y = 185;
      ctx.fillStyle = '#FFFFFF';
      drawRoundedRect(ctx, BOX_X, BOX_Y, BOX_W, BOX_H, 20);
      ctx.fill();

      // ── 6. QR code (drawn synchronously from pre-loaded image) ───────
      if (qrImg) {
        const pad = 20;
        ctx.drawImage(qrImg, BOX_X + pad, BOX_Y + pad, BOX_W - pad * 2, BOX_H - pad * 2);
      }

      // ── 7. Company / campaign name ───────────────────────────────────
      const textY = BOX_Y + BOX_H + 58;
      ctx.textAlign = 'center';
      ctx.font = 'bold 36px Arial, sans-serif';
      ctx.fillStyle = '#FFFFFF';
      let displayName = (companyName || campaignName).toUpperCase();
      while (ctx.measureText(displayName).width > W - 80 && displayName.length > 8)
        displayName = displayName.slice(0, -4) + '...';
      ctx.fillText(displayName, W / 2, textY);

      // ── 8. "CAMPANHA:" label ─────────────────────────────────────────
      ctx.font = '20px Arial, sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.70)';
      ctx.fillText('CAMPANHA:', W / 2, textY + 46);

      // ── 9. Date range ────────────────────────────────────────────────
      const startStr = campaignStartDate ? format(new Date(campaignStartDate), 'dd/MM/yyyy') : '—';
      const endStr   = campaignEndDate   ? format(new Date(campaignEndDate),   'dd/MM/yyyy') : '—';
      ctx.font = 'bold 32px Arial, sans-serif';
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(`${startStr} – ${endStr}`, W / 2, textY + 88);

      // ── 10. Bottom logos ─────────────────────────────────────────────
      const LOGO_H = 48, LOGO_Y = 880;
      if (astaImg && compImg) {
        const astaW = Math.round(astaImg.width * (LOGO_H / astaImg.height));
        const compW = Math.round(compImg.width * (LOGO_H / compImg.height));
        const GAP = 32, midX = W / 2;
        ctx.strokeStyle = 'rgba(255,255,255,0.30)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(midX, LOGO_Y - 8);
        ctx.lineTo(midX, LOGO_Y + LOGO_H + 8);
        ctx.stroke();
        ctx.drawImage(astaImg, midX - GAP - astaW, LOGO_Y, astaW, LOGO_H);
        ctx.drawImage(compImg,  midX + GAP,         LOGO_Y, compW, LOGO_H);
      } else if (astaImg) {
        const astaW = Math.round(astaImg.width * (LOGO_H / astaImg.height));
        ctx.drawImage(astaImg, (W - astaW) / 2, LOGO_Y, astaW, LOGO_H);
      }

      // ── 11. Download ─────────────────────────────────────────────────
      const link = document.createElement('a');
      link.download = `card-qr-${campaignName.replace(/\s+/g, '-').toLowerCase()}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();

    } finally {
      setGeneratingCard(false);
    }
  }, [campaignName, campaignStartDate, campaignEndDate, companyName, companyLogoUrl, surveyUrl]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm max-w-[calc(100vw-2rem)]">
        <DialogHeader>
          <DialogTitle>Acesso à Pesquisa</DialogTitle>
          <DialogDescription>{campaignName}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-5 py-1">
          {/* QR Code — clean, no logo hole */}
          <div
            ref={qrRef}
            className="p-5 bg-white rounded-2xl shadow-lg border border-gray-100 flex flex-col items-center gap-3 w-full"
          >
            <QRCodeSVG
              value={surveyUrl}
              size={220}
              level="M"
              includeMargin={false}
            />
            <div className="flex items-center gap-1">
              <span className="text-xs font-bold" style={{ color: NAVY }}>Vivamente</span>
              <span className="text-xs font-bold" style={{ color: '#16a34a' }}>360</span>
            </div>
          </div>

          {/* Link field + copy button */}
          <div className="w-full space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">Link Curto</p>
            <div className="flex gap-2">
              <Input
                readOnly
                value={surveyUrl}
                className="text-xs h-9"
                onClick={(e) => (e.target as HTMLInputElement).select()}
              />
              <Button
                size="sm"
                variant="outline"
                onClick={handleCopyLink}
                className="shrink-0 h-9 px-3 gap-1.5"
              >
                {copied
                  ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                  : <Copy className="h-3.5 w-3.5" />}
                <span className="text-xs">{copied ? 'Copiado' : 'Copiar'}</span>
              </Button>
            </div>
          </div>

          {/* Primary — download QR (with hover effect via Tailwind) */}
          <Button
            className="w-full h-11 text-sm font-semibold text-white gap-2 bg-green-500 hover:bg-green-600 active:bg-green-700 transition-colors"
            onClick={handleDownloadQr}
          >
            <Download className="h-4 w-4" />
            Baixar QR Code
          </Button>

          {/* Secondary — print + card */}
          <div className="flex gap-2 w-full">
            <Button
              variant="outline"
              className="flex-1 h-9 text-sm gap-2"
              onClick={handlePrint}
            >
              <Printer className="h-4 w-4" />
              Imprimir
            </Button>
            <Button
              variant="outline"
              className="flex-1 h-9 text-sm gap-2"
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
