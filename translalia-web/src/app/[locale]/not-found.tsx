import {useTranslations} from 'next-intl';

export default function NotFound() {
  const t = useTranslations('Common');
  return (
    <div className="flex h-screen w-full items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold">404</h1>
        <p className="mt-2 text-neutral-600">{t('error')}</p>
      </div>
    </div>
  );
}
