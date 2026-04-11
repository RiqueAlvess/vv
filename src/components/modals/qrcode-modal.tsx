'use client';

import { useRef, useCallback, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Link2, Download, FileDown, CheckCircle2 } from 'lucide-react';
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
  const qrRef = useRef<HTMLDivElement>(null);

  const handleCopyLink = useCallback(async () => {
    await navigator.clipboard.writeText(surveyUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [surveyUrl]);

  const handleDownloadPng = useCallback(() => {
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

  const handleDownloadPdf = useCallback(() => {
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
            @media print { @page { margin: 20mm; } }
            body { margin: 0; display: flex; flex-direction: column; align-items: center;
                   justify-content: center; min-height: 100vh; font-family: sans-serif; background: #fff; }
            h2 { font-size: 18px; margin-bottom: 8px; color: #111; }
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

  // Keep card download for future use (not exposed in UI)
  const _handleDownloadCard = useCallback(async () => {
    if (!qrRef.current) return;

    try {
      const W = 800;
      const H = 1000;
      const canvas = document.createElement('canvas');
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const loadImg = (src: string): Promise<HTMLImageElement | null> =>
        new Promise((resolve) => {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => resolve(img);
          img.onerror = () => resolve(null);
          img.src = src;
        });

      const bgImg = await loadImg('/bg.jpeg');
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

      const grad = ctx.createLinearGradient(0, 0, W, H);
      grad.addColorStop(0, 'rgba(13,61,79,0.82)');
      grad.addColorStop(0.5, 'rgba(13,61,79,0.68)');
      grad.addColorStop(1, 'rgba(26,46,53,0.60)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);

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

      ctx.textAlign = 'center';
      ctx.font = '26px Arial, sans-serif';
      ctx.fillStyle = '#1AA278';
      ctx.fillText('Mapeamento Psicossocial:', W / 2, 158);

      const BOX_W = 400, BOX_H = 400, BOX_X = (W - BOX_W) / 2, BOX_Y = 185, R = 20;
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
        if (qrImg) ctx.drawImage(qrImg, BOX_X + 20, BOX_Y + 20, QR_SIZE, QR_SIZE);
      }

      const textY = BOX_Y + BOX_H + 58;
      ctx.textAlign = 'center';
      ctx.font = 'bold 36px Arial, sans-serif';
      ctx.fillStyle = '#FFFFFF';
      let displayName = (companyName || campaignName).toUpperCase();
      while (ctx.measureText(displayName).width > W - 80 && displayName.length > 8)
        displayName = displayName.slice(0, -4) + '...';
      ctx.fillText(displayName, W / 2, textY);

      ctx.font = '20px Arial, sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.70)';
      ctx.fillText('CAMPANHA:', W / 2, textY + 46);

      const startStr = campaignStartDate ? format(new Date(campaignStartDate), 'dd/MM/yyyy') : '—';
      const endStr = campaignEndDate ? format(new Date(campaignEndDate), 'dd/MM/yyyy') : '—';
      ctx.font = 'bold 32px Arial, sans-serif';
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(`${startStr} – ${endStr}`, W / 2, textY + 88);

      const LOGO_H = 48, LOGO_Y = 880;
      const astaLogoUrl = process.env.NEXT_PUBLIC_LOGO_URL || '/logo.png';
      const [astaImg, compImg] = await Promise.all([
        loadImg(astaLogoUrl),
        companyLogoUrl ? loadImg(companyLogoUrl) : Promise.resolve(null),
      ]);

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
        ctx.drawImage(compImg, midX + GAP, LOGO_Y, compW, LOGO_H);
      } else if (astaImg) {
        const astaW = Math.round(astaImg.width * (LOGO_H / astaImg.height));
        ctx.drawImage(astaImg, (W - astaW) / 2, LOGO_Y, astaW, LOGO_H);
      }

      const link = document.createElement('a');
      link.download = `card-qr-${campaignName.replace(/\s+/g, '-').toLowerCase()}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch { /* silent */ }
  }, [campaignName, campaignStartDate, campaignEndDate, companyName, companyLogoUrl]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-w-sm">
        <DialogHeader>
          <DialogTitle>QR Code da Pesquisa</DialogTitle>
          <DialogDescription>{campaignName}</DialogDescription>
        </DialogHeader>

        <div className="py-1">
          <p className="text-xs text-muted-foreground mb-3">Preview do Card</p>

          <div className="flex gap-4 items-stretch">
            {/* Left — card preview */}
            <div className="flex flex-col items-center flex-1 min-w-0">
              <div className="relative w-full rounded-xl overflow-hidden border border-border shadow-sm bg-white">
                {/* Top-right decorative triangle */}
                <div
                  className="absolute top-0 right-0 w-14 h-14 pointer-events-none"
                  style={{
                    background: 'linear-gradient(135deg, transparent 50%, #16a34a 50%)',
                  }}
                />
                {/* Bottom-left decorative triangle */}
                <div
                  className="absolute bottom-0 left-0 w-14 h-14 pointer-events-none"
                  style={{
                    background: 'linear-gradient(315deg, transparent 50%, #16a34a 50%)',
                  }}
                />

                {/* QR code */}
                <div className="flex items-center justify-center px-5 pt-6 pb-4">
                  <div ref={qrRef} className="p-2 bg-white rounded-md border border-gray-200 shadow-sm">
                    <QRCodeSVG
                      value={surveyUrl}
                      size={130}
                      level="H"
                      includeMargin={false}
                    />
                  </div>
                </div>

                {/* Branding */}
                <div className="px-3 pb-3 flex items-center gap-1">
                  <span className="text-xs font-bold text-gray-700">Vivamente</span>
                  <span className="text-xs font-bold text-green-600">360</span>
                </div>
              </div>

              {/* URL below card */}
              <p className="text-[10px] text-muted-foreground text-center break-all px-1 mt-2 leading-tight">
                {surveyUrl}
              </p>
            </div>

            {/* Right — action buttons */}
            <div className="flex flex-col gap-2.5 w-[140px] shrink-0">
              <Button
                className="w-full h-16 flex-col gap-1 text-xs font-semibold rounded-xl text-white"
                style={{ backgroundColor: '#1B6157', hover: undefined }}
                onClick={handleCopyLink}
              >
                {copied
                  ? <CheckCircle2 className="h-5 w-5" />
                  : <Link2 className="h-5 w-5" />}
                <span>{copied ? 'Copiado!' : 'Copiar Link'}</span>
              </Button>

              <Button
                className="w-full h-16 flex-col gap-1 text-xs font-semibold rounded-xl text-white"
                style={{ backgroundColor: '#1B6157' }}
                onClick={handleDownloadPng}
              >
                <Download className="h-5 w-5" />
                <span>Baixar PNG</span>
              </Button>

              <Button
                className="w-full h-16 flex-col gap-1 text-xs font-semibold rounded-xl text-white"
                style={{ backgroundColor: '#16a34a' }}
                onClick={handleDownloadPdf}
              >
                <FileDown className="h-5 w-5" />
                <span className="text-center leading-tight">Baixar PDF para Impressão</span>
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
