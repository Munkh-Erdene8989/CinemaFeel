function Bone({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-2xl bg-white/[0.07] motion-reduce:animate-none ${className}`} />;
}

export function HeroSkeleton() {
  return (
    <section className="relative min-h-[710px] overflow-hidden bg-[#101014] pt-[72px]" aria-hidden="true">
      <div className="absolute inset-0 bg-[linear-gradient(90deg,#08080a_0%,rgba(8,8,10,.72)_42%,rgba(8,8,10,.2)_78%)]" />
      <div className="relative mx-auto flex min-h-[638px] max-w-[1440px] items-center px-5 pb-16 pt-16 md:px-10 lg:px-16">
        <div className="w-full max-w-2xl">
          <Bone className="h-3 w-40 rounded-full" />
          <Bone className="mt-6 h-16 w-full max-w-xl rounded-3xl sm:h-20" />
          <Bone className="mt-4 h-16 w-4/5 max-w-md rounded-3xl sm:h-20" />
          <Bone className="mt-8 h-4 w-full max-w-lg rounded-full" />
          <Bone className="mt-3 h-4 w-2/3 max-w-sm rounded-full" />
          <div className="mt-8 flex gap-3">
            <Bone className="h-12 w-36 rounded-full" />
            <Bone className="h-12 w-44 rounded-full" />
          </div>
        </div>
      </div>
    </section>
  );
}

export function CatalogSkeleton() {
  return (
    <section className="mx-auto max-w-[1440px] px-5 py-16 md:px-10 lg:px-16" aria-hidden="true">
      <Bone className="h-3 w-36 rounded-full" />
      <Bone className="mt-3 h-8 w-64 rounded-2xl" />
      <div className="mt-7 flex gap-2">
        <Bone className="h-8 w-16 rounded-full" />
        <Bone className="h-8 w-24 rounded-full" />
        <Bone className="h-8 w-20 rounded-full" />
        <Bone className="h-8 w-28 rounded-full" />
      </div>
      <FilmGridSkeleton />
    </section>
  );
}

export function FilmGridSkeleton({ count = 12 }: { count?: number }) {
  return (
    <div className="mt-6 grid grid-cols-2 gap-x-3 gap-y-8 sm:grid-cols-3 md:gap-x-5 lg:grid-cols-6" aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <div key={index}>
          <Bone className="aspect-[3/4.1] w-full rounded-2xl" />
          <Bone className="mt-3 h-4 w-4/5 rounded-full" />
          <Bone className="mt-2 h-3 w-1/2 rounded-full" />
        </div>
      ))}
    </div>
  );
}

export function WatchSkeleton() {
  return (
    <section className="mx-auto min-h-screen max-w-[1440px] px-5 pb-24 pt-28 md:px-10 lg:px-16" aria-hidden="true">
      <Bone className="h-4 w-40 rounded-full" />
      <div className="mt-6 grid items-start gap-8 lg:grid-cols-[minmax(280px,420px)_1fr]">
        <Bone className="mx-auto aspect-[9/16] w-full max-w-[420px] rounded-3xl" />
        <div>
          <Bone className="h-3 w-24 rounded-full" />
          <Bone className="mt-3 h-10 w-2/3 rounded-2xl" />
          <Bone className="mt-4 h-4 w-full rounded-full" />
          <Bone className="mt-2 h-4 w-5/6 rounded-full" />
          <div className="mt-8 space-y-2">
            <Bone className="h-16 w-full rounded-2xl" />
            <Bone className="h-16 w-full rounded-2xl" />
            <Bone className="h-16 w-full rounded-2xl" />
          </div>
        </div>
      </div>
    </section>
  );
}
