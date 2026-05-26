import InstructorDashboardTabs from './InstructorDashboardTabs';

export default function InstructorDashboardLayout({ title, subtitle, eyebrow, action, children }) {
  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-gnd-cream bg-white p-4 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            {eyebrow && (
              <p className="text-xs font-black uppercase tracking-[0.18em] text-gnd-red">
                {eyebrow}
              </p>
            )}
            <h1 className="mt-1 text-2xl font-black tracking-tight text-gnd-dark sm:text-3xl">
              {title}
            </h1>
            {subtitle && (
              <p className="mt-2 max-w-3xl text-sm font-bold leading-6 text-gnd-gray sm:text-base">
                {subtitle}
              </p>
            )}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>

        <div className="mt-5">
          <InstructorDashboardTabs />
        </div>
      </section>

      {children}
    </div>
  );
}
