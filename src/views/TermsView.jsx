import { useTranslation } from 'react-i18next';
import { Helmet } from 'react-helmet-async';

export default function TermsView() {
  const { t } = useTranslation();
  
  // Create an array of sections from the JSON object
  const sections = [1, 2, 3, 4, 5, 6, 7, 8].map(num => ({
    title: t(`legal.termsSections.${num}.title`),
    content: t(`legal.termsSections.${num}.content`)
  }));

  return (
    <>
      <Helmet>
        <title>{t('legal.termsTitle')} - GuideNextdoor</title>
        <meta name="robots" content="noindex" />
      </Helmet>
      
      <div className="mx-auto max-w-3xl px-5 py-16 md:px-8 md:py-24">
        <div className="mb-12">
          <h1 className="text-4xl font-black tracking-tight text-gnd-dark md:text-5xl">
            {t('legal.termsTitle')}
          </h1>
          <p className="mt-6 text-lg leading-relaxed text-gnd-gray">
            {t('legal.termsIntro')}
          </p>
        </div>
        
        <div className="flex flex-col gap-10">
          {sections.map((section, index) => (
            <section key={index} className="flex flex-col gap-3">
              <h2 className="text-xl font-bold tracking-tight text-gnd-dark">
                {section.title}
              </h2>
              <p className="text-base leading-relaxed text-gnd-gray whitespace-pre-wrap">
                {section.content}
              </p>
            </section>
          ))}
        </div>
      </div>
    </>
  );
}
