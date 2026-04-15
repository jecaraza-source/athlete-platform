import { getFileCategory, type FileCategory } from '@/lib/types/attachments';

const ICONS: Record<FileCategory, string> = {
  pdf:         '📄',
  image:       '🖼️',
  word:        '📝',
  excel:       '📊',
  powerpoint:  '📑',
  text:        '🗒️',
  other:       '📎',
};

const COLORS: Record<FileCategory, string> = {
  pdf:         'bg-red-50 text-red-600 border-red-200',
  image:       'bg-blue-50 text-blue-600 border-blue-200',
  word:        'bg-sky-50 text-sky-600 border-sky-200',
  excel:       'bg-green-50 text-green-600 border-green-200',
  powerpoint:  'bg-orange-50 text-orange-600 border-orange-200',
  text:        'bg-gray-50 text-gray-600 border-gray-200',
  other:       'bg-gray-50 text-gray-500 border-gray-200',
};

export default function FileIcon({
  mimeType,
  size = 'md',
}: {
  mimeType: string;
  size?: 'sm' | 'md' | 'lg';
}) {
  const category = getFileCategory(mimeType);
  const sizeClasses = {
    sm: 'w-7 h-7 text-base',
    md: 'w-9 h-9 text-xl',
    lg: 'w-12 h-12 text-2xl',
  }[size];

  return (
    <div
      className={`flex items-center justify-center rounded-lg border flex-shrink-0 ${sizeClasses} ${COLORS[category]}`}
    >
      <span role="img" aria-label={category}>{ICONS[category]}</span>
    </div>
  );
}
