import Image from 'next/image'

const SIZE_CLASSES: Record<number, string> = {
  24: 'w-6 h-6 text-[9px]',
  32: 'w-8 h-8 text-[10px]',
  40: 'w-10 h-10 text-xs',
  48: 'w-12 h-12 text-sm',
  64: 'w-16 h-16 text-lg',
}

export default function SchoolLogo({
  name,
  logoUrl,
  size = 40,
  className = '',
}: {
  name: string
  logoUrl?: string | null
  size?: 24 | 32 | 40 | 48 | 64
  className?: string
}) {
  const sizeClass = SIZE_CLASSES[size] || SIZE_CLASSES[40]
  const initial = (name || 'S')[0].toUpperCase()

  if (logoUrl) {
    return (
      <Image
        src={logoUrl}
        alt={`${name} logo`}
        width={size}
        height={size}
        className={`rounded-lg object-cover flex-shrink-0 ${sizeClass.split(' ').slice(0, 2).join(' ')} ${className}`}
      />
    )
  }

  return (
    <div
      className={`rounded-lg flex items-center justify-center font-bold text-white flex-shrink-0 ${sizeClass} ${className}`}
      style={{ background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)' }}
    >
      {initial}
    </div>
  )
}
