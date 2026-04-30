'use client';

import { useEffect, useState } from 'react';
import { fetchCharacterAssetUrl } from '@/lib/themes';
import { buildAssetCode, type Gender } from '@/lib/constants';
import { UI_COPY, type Locale } from '@/lib/i18n';

type Props = {
  gender: Gender;
  hair: string;
  eye: string;
  showCaption?: boolean;
  size?: 'sm' | 'md' | 'lg';
  locale?: Locale;
};

export default function CharacterPreview({
  gender,
  hair,
  eye,
  showCaption = true,
  size = 'lg',
  locale = 'id',
}: Props) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setNotFound(false);
    fetchCharacterAssetUrl({ gender, hair_style_code: hair, eyeglasses_code: eye })
      .then((url) => {
        if (!active) return;
        if (url) {
          setImageUrl(url);
          setNotFound(false);
        } else {
          setImageUrl(null);
          setNotFound(true);
        }
      })
      .catch(() => {
        if (!active) return;
        setImageUrl(null);
        setNotFound(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [gender, hair, eye]);

  const assetCode = buildAssetCode(gender, hair, eye);
  const sizeClass = size === 'sm' ? 'w-32 h-36' : size === 'md' ? 'w-44 h-52' : 'w-56 h-64';
  const copy = UI_COPY[locale];

  return (
    <div className="border-[2.5px] border-line rounded-[22px] bg-gradient-to-b from-[#fafaff] to-[#f3f4ff] p-5 text-center relative overflow-hidden">
      {/* paper grain */}
      <div className="absolute inset-0 pointer-events-none opacity-60"
        style={{
          backgroundImage:
            'radial-gradient(circle at 20% 30%, rgba(139,145,232,.05) 0%, transparent 30%), radial-gradient(circle at 80% 70%, rgba(255,213,213,.08) 0%, transparent 30%)',
        }}
      />

      <div className="relative w-full h-64 flex items-end justify-center">
        {/* shadow */}
        <div
          className="absolute bottom-1.5 left-1/2 -translate-x-1/2 z-0 animate-shadow-pulse"
          style={{
            width: '110px',
            height: '14px',
            background: 'radial-gradient(ellipse, rgba(90,98,204,.25) 0%, transparent 70%)',
          }}
        />
        <div className={`relative z-10 animate-float-char ${sizeClass}`}>
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageUrl}
              alt={assetCode}
              className="w-full h-full object-contain"
              draggable={false}
            />
          ) : loading ? (
            <div className="w-full h-full flex items-center justify-center">
              <div className="w-10 h-10 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <FallbackCharacter gender={gender} hair={hair} eye={eye} />
          )}
        </div>
      </div>

      {showCaption && (
        <p className="mt-3 text-[12px] text-ink-soft leading-relaxed">
          {copy.characterCaption}
        </p>
      )}

      <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 bg-paper border border-line rounded-full">
        <span className={`w-1.5 h-1.5 rounded-full ${notFound ? 'bg-danger' : 'bg-success'}`} />
        <span className="font-mono text-[11px] text-accent-deep tracking-wide">{assetCode}</span>
      </div>

      {notFound && (
        <p className="text-[11px] text-danger mt-2">
          {copy.characterUnavailable}
        </p>
      )}
    </div>
  );
}

// ====== Fallback SVG saat asset belum diupload admin ======
function FallbackCharacter({ gender, hair, eye }: { gender: Gender; hair: string; eye: string }) {
  const isBoy = gender === 'boy';
  const skin = '#ffd9c2';
  const skinShade = '#f4b89a';
  const hairTints = ['#a8a8b8', '#3a2a1e', '#7a5230', '#d4a574', '#1f1a16', '#5d4037', '#c9b08c', '#704030', '#9c8060'];
  const hairIdx = hair.charCodeAt(1) - 65;
  const hairColor = hairTints[hairIdx % hairTints.length];

  const outfitMain = isBoy ? '#a8c8e8' : '#f4a8c8';
  const outfitStripe = '#ffffff';

  const hairShapes = [
    `<path d="M70 70 Q60 35 110 30 Q160 35 150 70 Q150 60 130 58 Q120 50 110 55 Q100 50 90 58 Q70 60 70 70 Z" fill="${hairColor}"/>`,
    `<path d="M68 75 Q55 30 110 28 Q165 30 152 75 Q150 65 140 65 Q135 55 120 58 Q110 48 100 58 Q85 55 80 65 Q70 65 68 75 Z" fill="${hairColor}"/>`,
    `<path d="M72 70 L80 35 L92 60 L100 30 L112 60 L122 35 L132 60 L145 35 L150 70 Z" fill="${hairColor}"/>`,
    `<path d="M65 75 Q65 40 110 35 Q155 40 155 75 Q155 70 145 70 Q120 65 110 65 Q90 65 75 70 Q65 70 65 75 Z" fill="${hairColor}"/>`,
    `<path d="M65 80 Q55 30 110 28 Q165 30 155 80 L155 110 Q150 95 150 80 Q150 70 140 65 Q135 55 120 58 Q110 48 100 58 Q85 55 80 65 Q70 70 70 80 L70 110 Q65 95 65 80 Z" fill="${hairColor}"/>`,
    `<path d="M65 75 Q60 35 110 30 Q160 35 155 75 Q155 65 145 60 Q135 50 110 55 Q85 50 75 60 Q65 65 65 75 Z" fill="${hairColor}"/><ellipse cx="55" cy="95" rx="14" ry="22" fill="${hairColor}"/><ellipse cx="165" cy="95" rx="14" ry="22" fill="${hairColor}"/>`,
    `<circle cx="110" cy="55" r="48" fill="${hairColor}"/>`,
    `<path d="M75 70 Q75 50 110 48 Q145 50 145 70 Z" fill="${hairColor}" opacity=".7"/>`,
    `<path d="M68 72 Q60 34 110 30 Q165 34 152 72 Q140 50 110 50 Q95 56 80 64 Q70 65 68 72 Z" fill="${hairColor}"/>`,
  ];
  const hairSvg = hairShapes[hairIdx % hairShapes.length];

  const eyeShapes = [
    ``,
    `<g stroke="#2a2748" stroke-width="2" fill="none"><circle cx="92" cy="92" r="9"/><circle cx="128" cy="92" r="9"/><line x1="101" y1="92" x2="119" y2="92"/></g>`,
    `<g stroke="#2a2748" stroke-width="2" fill="none"><rect x="83" y="84" width="18" height="14" rx="2"/><rect x="119" y="84" width="18" height="14" rx="2"/><line x1="101" y1="91" x2="119" y2="91"/></g>`,
    `<g stroke="#e85a78" stroke-width="2" fill="none"><path d="M83 92 Q83 84 92 84 Q100 84 92 95 Q92 95 83 92 Z"/><path d="M120 92 Q120 84 129 84 Q137 84 129 95 Q129 95 120 92 Z"/></g>`,
    `<g stroke="#2a2748" stroke-width="2" fill="none"><path d="M82 92 Q83 85 100 85 L100 95 Q90 96 82 92 Z"/><path d="M120 95 L120 85 Q137 85 138 92 Q130 96 120 95 Z"/></g>`,
    `<g fill="#2a2748"><rect x="82" y="86" width="20" height="10" rx="3"/><rect x="118" y="86" width="20" height="10" rx="3"/><rect x="100" y="89" width="20" height="2"/></g>`,
    `<g stroke="#7a8aa8" stroke-width="2" fill="rgba(168,200,232,.3)"><path d="M82 88 Q82 100 92 100 Q102 100 102 88 Z"/><path d="M118 88 Q118 100 128 100 Q138 100 138 88 Z"/><line x1="102" y1="91" x2="118" y2="91"/></g>`,
    `<g stroke="#2a2748" stroke-width="2" fill="none"><ellipse cx="92" cy="92" rx="11" ry="7"/><ellipse cx="128" cy="92" rx="11" ry="7"/><line x1="103" y1="92" x2="117" y2="92"/></g>`,
    `<g stroke="#2a2748" stroke-width="2" fill="none"><circle cx="92" cy="92" r="8"/><circle cx="128" cy="92" r="8"/><rect x="108" y="89" width="4" height="6" fill="#2a2748" stroke="none"/></g>`,
  ];
  const eyeIdx = eye.charCodeAt(1) - 65;
  const eyeSvg = eyeShapes[eyeIdx % eyeShapes.length];

  const isLong = !isBoy;

  return (
    <svg viewBox="0 0 220 280" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <defs>
        <radialGradient id="grass-fb" cx="50%" cy="50%">
          <stop offset="0%" stopColor="#cce8d3" stopOpacity=".8" />
          <stop offset="100%" stopColor="#cce8d3" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="110" cy="262" rx="70" ry="10" fill="url(#grass-fb)" />
      <g
        dangerouslySetInnerHTML={{
          __html: `
            <path d="M75 130 Q40 110 35 80 Q33 75 38 73 Q43 72 48 80 Q55 95 78 115 Z" fill="${skin}" stroke="${skinShade}" stroke-width="0.5"/>
            <path d="M145 130 Q180 110 185 80 Q187 75 182 73 Q177 72 172 80 Q165 95 142 115 Z" fill="${skin}" stroke="${skinShade}" stroke-width="0.5"/>
            <path d="M70 130 Q70 120 80 118 L140 118 Q150 120 150 130 L155 200 Q150 210 140 210 L80 210 Q70 210 65 200 Z" fill="${outfitMain}"/>
            <path d="M70 145 L150 145" stroke="${outfitStripe}" stroke-width="3" opacity=".8"/>
            <path d="M68 165 L152 165" stroke="${outfitStripe}" stroke-width="3" opacity=".8"/>
            <path d="M66 185 L154 185" stroke="${outfitStripe}" stroke-width="3" opacity=".8"/>
            ${
              isLong
                ? `<path d="M72 200 L148 200 L160 240 L60 240 Z" fill="${outfitMain}" opacity=".95"/>`
                : `<path d="M75 200 L145 200 L142 235 L78 235 Z" fill="${outfitMain}" opacity=".95"/>`
            }
            <rect x="88" y="${isLong ? 235 : 230}" width="14" height="${isLong ? 20 : 24}" rx="6" fill="${skin}"/>
            <rect x="118" y="${isLong ? 235 : 230}" width="14" height="${isLong ? 20 : 24}" rx="6" fill="${skin}"/>
            <ellipse cx="68" cy="92" rx="6" ry="9" fill="${skin}"/>
            <ellipse cx="152" cy="92" rx="6" ry="9" fill="${skin}"/>
            <ellipse cx="110" cy="92" rx="42" ry="44" fill="${skin}"/>
            ${hairSvg}
            <ellipse cx="80" cy="105" rx="6" ry="4" fill="#ffadc4" opacity=".55"/>
            <ellipse cx="140" cy="105" rx="6" ry="4" fill="#ffadc4" opacity=".55"/>
            <ellipse cx="92" cy="92" rx="2.4" ry="3" fill="#2a2748"/>
            <ellipse cx="128" cy="92" rx="2.4" ry="3" fill="#2a2748"/>
            <circle cx="93" cy="91" r=".8" fill="#fff"/>
            <circle cx="129" cy="91" r=".8" fill="#fff"/>
            ${eyeSvg}
            <path d="M100 110 Q110 116 120 110" stroke="#2a2748" stroke-width="1.6" fill="none" stroke-linecap="round"/>
            <path d="M108 100 Q110 104 112 100" stroke="${skinShade}" stroke-width="1" fill="none" stroke-linecap="round"/>
          `,
        }}
      />
    </svg>
  );
}
