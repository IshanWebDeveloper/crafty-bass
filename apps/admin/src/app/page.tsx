import { Checkbox, ModeToggle, Button } from '@repo/ui';

const stats = [
  { label: 'Open reports', value: '12' },
  { label: 'Pending verifications', value: '8' },
  { label: 'Active jobs', value: '43' },
];

export default function AdminHome() {
  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div>
            <p className="text-sm text-muted-foreground">Crafty Bass</p>
            <h1 className="text-2xl font-semibold">Admin</h1>
          </div>
          <ModeToggle />
        </div>
      </header>
      <section className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-8">
        <div className="grid gap-4 md:grid-cols-3">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="rounded-lg border border-border p-4"
            >
              <p className="text-sm text-muted-foreground">{stat.label}</p>
              <p className="mt-2 text-3xl font-semibold">{stat.value}</p>
            </div>
          ))}
        </div>
        <div className="rounded-lg border border-border p-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-medium">Review queue</h2>
              <p className="text-sm text-muted-foreground">
                Triage reports, profile checks, and marketplace quality tasks.
              </p>
            </div>
            <Button>Open queue</Button>
          </div>
          <label className="mt-6 flex items-center gap-2 text-sm">
            <Checkbox aria-label="Show urgent items only" />
            Show urgent items only
          </label>
        </div>
      </section>
    </main>
  );
}
