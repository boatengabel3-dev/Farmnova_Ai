import React from 'react';
import type { CropId } from '../types';

export const FarmovaLogo: React.FC<{ size?: number; className?: string }> = ({ size = 36, className = '' }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 64 64"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-label="Farmova AI Logo"
  >
    <rect width="64" height="64" rx="16" fill="#1F5A2E" />
    <path
      d="M12 39C18 48 30 53 43 49C51 46 56 39 54 30"
      stroke="#E3A72F"
      strokeWidth="2.8"
      strokeLinecap="round"
    />
    <circle cx="51" cy="21" r="3.2" fill="#E3A72F" />
    <path d="M20 42C20 28 30 17 44 17C44 31 34 42 20 42Z" fill="#F6EFE0" />
    <path d="M20 42C27 35 34 28 42 20" stroke="#1F5A2E" strokeWidth="2.4" strokeLinecap="round" />
    <path d="M27 35V28" stroke="#1F5A2E" strokeWidth="1.8" strokeLinecap="round" />
    <path d="M32 30H39" stroke="#1F5A2E" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

export const CropIllustration: React.FC<{ crop: CropId; className?: string }> = ({ crop, className = 'w-12 h-12' }) => {
  switch (crop) {
    case 'maize':
      return (
        <svg viewBox="0 0 48 48" fill="none" className={className} aria-hidden="true">
          <path d="M18 39C13 31 12 22 15 15C18 22 19 30 20 39" fill="#2E7D32" />
          <path d="M30 39C35 31 36 22 33 15C30 22 29 30 28 39" fill="#1F5A2E" />
          <ellipse cx="24" cy="23" rx="6.5" ry="13" fill="#E3A72F" />
          <path d="M20 17H28M19 22H29M19 27H29M20 32H28" stroke="#B27B12" strokeWidth="1.4" strokeLinecap="round" />
          <path d="M24 10V6M21 11L19 7M27 11L29 7" stroke="#A2461F" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      );
    case 'cassava':
      return (
        <svg viewBox="0 0 48 48" fill="none" className={className} aria-hidden="true">
          <path d="M24 22V8" stroke="#1F5A2E" strokeWidth="2.4" strokeLinecap="round" />
          <path d="M24 11L15 7M24 11L33 7M24 14L17 15M24 14L31 15" stroke="#2E7D32" strokeWidth="2.2" strokeLinecap="round" />
          <path d="M24 22C18 24 13 30 12 37C16 37 21 33 24 27Z" fill="#A2461F" />
          <path d="M24 22C30 24 35 31 36 38C31 38 27 33 24 27Z" fill="#8C3B19" />
          <path d="M24 23C22 29 22 35 24 41C26 35 26 29 24 23Z" fill="#B85A30" />
        </svg>
      );
    case 'yam':
      return (
        <svg viewBox="0 0 48 48" fill="none" className={className} aria-hidden="true">
          <path d="M11 35C18 28 30 28 37 35" stroke="#1F5A2E" strokeWidth="2" strokeLinecap="round" />
          <path d="M24 22V10M24 15C28 12 32 13 34 15M24 13C20 10 16 11 14 13" stroke="#1F5A2E" strokeWidth="2" strokeLinecap="round" />
          <ellipse cx="24" cy="31" rx="11" ry="7.5" transform="rotate(-8 24 31)" fill="#8C4A27" />
          <path d="M18 30H21M26 33H29M22 27H25" stroke="#5E2F17" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    case 'rice':
      return (
        <svg viewBox="0 0 48 48" fill="none" className={className} aria-hidden="true">
          <path d="M24 40V18C24 13 28 10 33 9" stroke="#1F5A2E" strokeWidth="2.2" strokeLinecap="round" />
          <path d="M24 40C20 30 16 22 14 16" stroke="#2E7D32" strokeWidth="2" strokeLinecap="round" />
          <ellipse cx="32" cy="11" rx="2.5" ry="4" transform="rotate(35 32 11)" fill="#E3A72F" />
          <ellipse cx="29" cy="15" rx="2.5" ry="4" transform="rotate(25 29 15)" fill="#E3A72F" />
          <ellipse cx="27" cy="20" rx="2.5" ry="4" transform="rotate(15 27 20)" fill="#E3A72F" />
          <ellipse cx="16" cy="18" rx="2.3" ry="3.8" transform="rotate(-25 16 18)" fill="#D99B26" />
          <ellipse cx="18" cy="23" rx="2.3" ry="3.8" transform="rotate(-15 18 23)" fill="#D99B26" />
        </svg>
      );
    case 'groundnut':
      return (
        <svg viewBox="0 0 48 48" fill="none" className={className} aria-hidden="true">
          <path d="M15 24C11 24 9 29 12 33C15 36 20 35 23 32C26 35 31 36 34 33C37 29 35 24 31 24C28 24 26 26 23 26C20 26 18 24 15 24Z" fill="#D49B4B" />
          <path d="M16 29C19 30 27 30 30 29" stroke="#9C6A24" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M23 23V12M23 16C18 14 15 16 14 19M23 15C28 13 31 15 32 18" stroke="#1F5A2E" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
    case 'cowpea':
      return (
        <svg viewBox="0 0 48 48" fill="none" className={className} aria-hidden="true">
          <path d="M24 10C18 16 14 25 17 37" stroke="#1F5A2E" strokeWidth="3.5" strokeLinecap="round" />
          <path d="M24 10C30 16 34 25 31 37" stroke="#2E7D32" strokeWidth="3.5" strokeLinecap="round" />
          <circle cx="17" cy="22" r="2.6" fill="#F6EFE0" stroke="#1F5A2E" strokeWidth="1.2" />
          <circle cx="16.5" cy="29" r="2.6" fill="#F6EFE0" stroke="#1F5A2E" strokeWidth="1.2" />
          <circle cx="31" cy="22" r="2.6" fill="#F6EFE0" stroke="#1F5A2E" strokeWidth="1.2" />
          <circle cx="31.5" cy="29" r="2.6" fill="#F6EFE0" stroke="#1F5A2E" strokeWidth="1.2" />
        </svg>
      );
    case 'soybean':
      return (
        <svg viewBox="0 0 48 48" fill="none" className={className} aria-hidden="true">
          <path d="M24 39V11" stroke="#1F5A2E" strokeWidth="2.4" strokeLinecap="round" />
          <path d="M24 15C18 14 14 17 14 21C18 21 22 19 24 15Z" fill="#2E7D32" />
          <path d="M24 19C30 18 34 21 34 25C30 25 26 23 24 19Z" fill="#1F5A2E" />
          <ellipse cx="18" cy="29" rx="4.5" ry="3.2" transform="rotate(-25 18 29)" fill="#C6A136" />
          <ellipse cx="30" cy="31" rx="4.5" ry="3.2" transform="rotate(25 30 31)" fill="#C6A136" />
        </svg>
      );
    case 'vegetables':
      return (
        <svg viewBox="0 0 48 48" fill="none" className={className} aria-hidden="true">
          <circle cx="20" cy="28" r="9" fill="#C63D23" />
          <path d="M20 19C18 16 16 15 14 16M20 19C22 16 24 15 26 16M20 19V14" stroke="#1F5A2E" strokeWidth="2" strokeLinecap="round" />
          <path d="M29 18C33 18 36 22 36 29C36 34 33 37 30 37C27 37 26 33 27 27C27 22 27 18 29 18Z" fill="#2E7D32" />
          <path d="M30 18V14" stroke="#1F5A2E" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
    case 'help_me_decide':
      return (
        <svg viewBox="0 0 48 48" fill="none" className={className} aria-hidden="true">
          <circle cx="24" cy="24" r="16" fill="#E3A72F" fillOpacity="0.22" stroke="#E3A72F" strokeWidth="2.2" />
          <path d="M19 19C19 16 21.5 14 24.5 14C27.5 14 29.5 16 29.5 18.5C29.5 21 27 22 25 23.5C24 24.3 24 25.5 24 27" stroke="#1F5A2E" strokeWidth="2.6" strokeLinecap="round" />
          <circle cx="24" cy="32.5" r="1.8" fill="#1F5A2E" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 48 48" fill="none" className={className} aria-hidden="true">
          <path d="M24 38V20" stroke="#1F5A2E" strokeWidth="2.4" strokeLinecap="round" />
          <path d="M24 23C17 23 13 18 13 13C19 13 24 17 24 23Z" fill="#2E7D32" />
          <path d="M24 21C31 21 35 16 35 11C29 11 24 15 24 21Z" fill="#1F5A2E" />
          <path d="M13 38H35" stroke="#A2461F" strokeWidth="2.4" strokeLinecap="round" />
        </svg>
      );
  }
};

export const FarmSizeIllustration: React.FC<{ tier: 'small' | 'medium' | 'large'; className?: string }> = ({
  tier,
  className = 'w-12 h-10',
}) => {
  const count = tier === 'small' ? 1 : tier === 'medium' ? 2 : 3;
  return (
    <svg viewBox="0 0 60 40" fill="none" className={className} aria-hidden="true">
      <rect x="4" y="8" width="52" height="26" rx="4" stroke="#1F5A2E" strokeWidth="1.8" strokeDasharray="3 3" fill="#1F5A2E" fillOpacity="0.06" />
      {Array.from({ length: count }).map((_, idx) => (
        <rect
          key={idx}
          x={9 + idx * 15}
          y={13}
          width="12"
          height="16"
          rx="2"
          fill={idx === 0 ? '#1F5A2E' : idx === 1 ? '#2E7D32' : '#E3A72F'}
          fillOpacity="0.85"
        />
      ))}
    </svg>
  );
};
