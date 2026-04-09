'use client';

import { useRef, useCallback } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Copy, Printer, Download, CheckCircle2, ImageDown } from 'lucide-react';
import { useState } from 'react';
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

  const handlePrint = useCallback(() => {
    const printWindow = window.open('', '_blank');
    if (!printWindow || !qrRef.current) return;

    const svgEl = qrRef.current.querySelector('svg');
    if (!svgEl) return;

    const svgClone = svgEl.cloneNode(true) as SVGElement;
    svgClone.setAttribute('width', '300');
    svgClone.setAttribute('height', '300');

    printWindow.document.write(`
      <html>
        <head>
          <title>QR Code — ${campaignName}</title>
          <style>
            body { margin: 0; display: flex; flex-direction: column; align-items: center;
                   justify-content: center; min-height: 100vh; font-family: sans-serif; }
            h2 { font-size: 18px; margin-bottom: 8px; }
            p { font-size: 12px; color: #666; margin: 4px 0; word-break: break-all; max-width: 300px; text-align: center; }
          </style>
        </head>
        <body>
          <h2>Mapeamento de Riscos Psicossociais</h2>
          <p>${campaignName}</p>
          ${svgClone.outerHTML}
          <p style="margin-top: 12px;">${surveyUrl}</p>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    printWindow.close();
  }, [campaignName, surveyUrl]);

  const handleDownload = useCallback(() => {
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
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

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

      // Helper: load an image from a URL, resolves null on error
      const loadImg = (src: string): Promise<HTMLImageElement | null> =>
        new Promise((resolve) => {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => resolve(img);
          img.onerror = () => resolve(null);
          img.src = src;
        });

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
      const svgEl = qrRef.current.querySelector('svg');
      if (svgEl) {
        const svgClone = svgEl.cloneNode(true) as SVGElement;
        const QR_SIZE = 360;
        svgClone.setAttribute('width', String(QR_SIZE));
        svgClone.setAttribute('height', String(QR_SIZE));
        const svgData = new XMLSerializer().serializeToString(svgClone);
        const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
        const blobUrl = URL.createObjectURL(blob);
        const qrImg = await loadImg(blobUrl);
        URL.revokeObjectURL(blobUrl);
        if (qrImg) {
          ctx.drawImage(qrImg, BOX_X + 20, BOX_Y + 20, QR_SIZE, QR_SIZE);
        }
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
      link.download = `card-qr-${campaignName.replace(/\s+/g, '-').toLowerCase()}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } finally {
      setGeneratingCard(false);
    }
  }, [campaignName, campaignStartDate, campaignEndDate, companyName, companyLogoUrl]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>QR Code da Pesquisa</DialogTitle>
          <DialogDescription>{campaignName}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-6 py-2">
          {/* QR Code */}
          <div ref={qrRef} className="p-4 bg-white rounded-xl border shadow-sm">
            <QRCodeSVG
              value={surveyUrl}
              size={220}
              level="H"
              includeMargin={false}
            />
          </div>

          {/* URL display */}
          <p className="text-xs text-muted-foreground text-center break-all px-2 max-w-xs">
            {surveyUrl}
          </p>

          {/* Actions */}
          <div className="flex gap-2 w-full">
            <Button
              variant="outline"
              className="flex-1"
              onClick={handleCopyLink}
            >
              {copied ? (
                <><CheckCircle2 className="h-4 w-4 mr-2 text-green-500" />Copiado!</>
              ) : (
                <><Copy className="h-4 w-4 mr-2" />Copiar link</>
              )}
            </Button>
          </div>
          <div className="flex gap-2 w-full">
            <Button variant="outline" className="flex-1" onClick={handlePrint}>
              <Printer className="h-4 w-4 mr-2" />
              Imprimir
            </Button>
            <Button variant="outline" className="flex-1" onClick={handleDownload}>
              <Download className="h-4 w-4 mr-2" />
              Baixar QR
            </Button>
          </div>
          <div className="flex gap-2 w-full">
            <Button
              variant="outline"
              className="flex-1"
              onClick={handleDownloadCard}
              disabled={generatingCard}
            >
              <ImageDown className="h-4 w-4 mr-2" />
              {generatingCard ? 'Gerando...' : 'Baixar Card'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
