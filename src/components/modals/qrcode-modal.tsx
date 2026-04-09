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

// DNV brand colors
const NAVY   = '#144660';
const GREEN  = '#1ff28d';
const GRAY   = '#ebf0eb';
const MUTED  = '#6B7280';
const LIGHT  = '#9CA3AF';

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
                   justify-content: center; min-height: 100vh; font-family: Arial, sans-serif; background: #fff; }
            .header { background: ${NAVY}; width: 100%; padding: 24px 40px 20px; box-sizing: border-box; }
            .logo { font-size: 32px; font-weight: 800; letter-spacing: -1px; }
            .logo-main { color: #fff; }
            .logo-360 { color: ${GREEN}; }
            .subtitle { color: rgba(255,255,255,0.65); font-size: 13px; margin-top: 4px; }
            .body { padding: 32px 40px; display: flex; flex-direction: column; align-items: center; }
            h2 { font-size: 17px; color: ${NAVY}; margin: 0 0 4px; text-align: center; }
            p  { font-size: 12px; color: ${MUTED}; margin: 4px 0; word-break: break-all; max-width: 300px; text-align: center; }
            .footer { background: ${NAVY}; width: 100%; padding: 12px; text-align: center;
                      font-size: 11px; color: rgba(255,255,255,0.5); }
            .accent-bar { height: 4px; background: ${GREEN}; width: 100%; }
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
            ${svgClone.outerHTML}
            <p style="margin-top: 16px; color:${LIGHT};">${surveyUrl}</p>
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

  const handleDownload = useCallback(() => {
    if (!qrRef.current) return;
    const svgEl = qrRef.current.querySelector('svg');
    if (!svgEl) return;

    const W = 560;
    const H = 800;

    const canvas = document.createElement('canvas');
    canvas.width  = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = NAVY;
    ctx.fillRect(0, 0, W, 140);

    ctx.font = 'bold 46px Arial, Helvetica, sans-serif';
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('Vivamente', 40, 82);
    const vivW = ctx.measureText('Vivamente').width;
    ctx.fillStyle = GREEN;
    ctx.fillText('360', 40 + vivW, 82);

    ctx.font = '15px Arial, Helvetica, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    ctx.fillText('Mapeamento de Riscos Psicossociais', 40, 112);

    ctx.fillStyle = GREEN;
    ctx.fillRect(0, 140, W, 5);

    const qrBoxSize = 340;
    const qrBoxX = (W - qrBoxSize) / 2;
    const qrBoxY = 175;

    ctx.save();
    ctx.shadowColor = 'rgba(20,70,96,0.12)';
    ctx.shadowBlur  = 24;
    ctx.shadowOffsetY = 6;
    ctx.fillStyle = '#ffffff';
    drawRoundedRect(ctx, qrBoxX, qrBoxY, qrBoxSize, qrBoxSize, 18);
    ctx.fill();
    ctx.restore();

    ctx.textAlign = 'center';
    ctx.font = 'bold 20px Arial, Helvetica, sans-serif';
    ctx.fillStyle = NAVY;

    const maxW = W - 80;
    let name = campaignName;
    if (ctx.measureText(name).width > maxW) {
      while (ctx.measureText(name + '…').width > maxW && name.length > 1)
        name = name.slice(0, -1);
      name += '…';
    }
    ctx.fillText(name, W / 2, qrBoxY + qrBoxSize + 44);

    ctx.font = '14px Arial, Helvetica, sans-serif';
    ctx.fillStyle = MUTED;
    ctx.fillText('Escaneie o QR Code para participar', W / 2, qrBoxY + qrBoxSize + 70);

    ctx.beginPath();
    ctx.strokeStyle = GRAY;
    ctx.lineWidth = 1;
    ctx.moveTo(40, qrBoxY + qrBoxSize + 94);
    ctx.lineTo(W - 40, qrBoxY + qrBoxSize + 94);
    ctx.stroke();

    ctx.font = '11px Arial, Helvetica, sans-serif';
    ctx.fillStyle = LIGHT;
    let urlText = surveyUrl;
    const maxUrlW = W - 80;
    while (ctx.measureText(urlText).width > maxUrlW && urlText.length > 20)
      urlText = urlText.slice(0, -1);
    if (urlText !== surveyUrl) urlText += '…';
    ctx.fillText(urlText, W / 2, qrBoxY + qrBoxSize + 118);

    ctx.fillStyle = NAVY;
    ctx.fillRect(0, H - 56, W, 56);
    ctx.font = '12px Arial, Helvetica, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.textAlign = 'center';
    ctx.fillText('Vivamente360 — Plataforma de Riscos Psicossociais NR-1', W / 2, H - 22);

    const svgData = new XMLSerializer().serializeToString(svgEl);
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    const img = new Image();
    img.onload = () => {
      const pad = 30;
      ctx.drawImage(img, qrBoxX + pad, qrBoxY + pad, qrBoxSize - pad * 2, qrBoxSize - pad * 2);
      URL.revokeObjectURL(url);

      const link = document.createElement('a');
      link.download = `qrcode-${campaignName.replace(/\s+/g, '-').toLowerCase()}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    };
    img.src = url;
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
        ctx.fillStyle = NAVY;
        ctx.fillRect(0, 0, W, H);
      }

      // ── 2. Dark gradient overlay ─────────────────────────────────────
      const grad = ctx.createLinearGradient(0, 0, W, H);
      grad.addColorStop(0, 'rgba(20,70,96,0.82)');
      grad.addColorStop(0.5, 'rgba(20,70,96,0.68)');
      grad.addColorStop(1, 'rgba(13,42,61,0.60)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);

      // ── 3. "Vivamente" (white) + "360" (green) title ─────────────────
      ctx.textBaseline = 'alphabetic';
      ctx.font = '900 72px Arial, sans-serif';
      const vivText = 'Vivamente';
      const num360 = '360';
      const vivTextW = ctx.measureText(vivText).width;
      const num360W  = ctx.measureText(num360).width;
      const titleStartX = (W - vivTextW - num360W) / 2;
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(vivText, titleStartX, 120);
      ctx.fillStyle = GREEN;
      ctx.fillText(num360, titleStartX + vivTextW, 120);

      // ── 4. Subtitle ──────────────────────────────────────────────────
      ctx.textAlign = 'center';
      ctx.font = '26px Arial, sans-serif';
      ctx.fillStyle = GREEN;
      ctx.fillText('Mapeamento Psicossocial:', W / 2, 158);

      // ── 5. White rounded box ─────────────────────────────────────────
      const BOX_W = 400;
      const BOX_H = 400;
      const BOX_X = (W - BOX_W) / 2;
      const BOX_Y = 185;
      ctx.fillStyle = '#FFFFFF';
      drawRoundedRect(ctx, BOX_X, BOX_Y, BOX_W, BOX_H, 20);
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
          {/* QR Code preview */}
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
