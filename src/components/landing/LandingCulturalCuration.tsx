import { Heart, Sparkles, Users } from "lucide-react";

const highlights = [
  {
    title: "Your culture is part of the lesson",
    description:
      "We connect concepts to the stories, contexts, and communities that feel familiar and real.",
    icon: Heart,
  },
  {
    title: "Your pace and voice lead",
    description:
      "Tutoring adapts to how you learn best — from language and examples to the speed of practice.",
    icon: Sparkles,
  },
  {
    title: "Built with educators who care",
    description:
      "We collaborate with teachers studying culturally responsive learning to make it feel right.",
    icon: Users,
  },
];

export function LandingCulturalCuration() {
  return (
    <section className="relative py-24 bg-background overflow-hidden">
      <div className="absolute inset-0 -z-10">
        <div className="absolute -top-16 left-8 h-64 w-64 rounded-full bg-secondary/20 blur-3xl" />
        <div className="absolute -bottom-16 right-8 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />
      </div>

      <div className="container mx-auto px-4 md:px-6">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-6 text-center lg:text-left">
            <span className="inline-flex items-center rounded-full bg-primary/10 px-4 py-1 text-xs font-bold uppercase tracking-wider text-primary">
              Culturally Curated
            </span>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-display font-bold text-foreground leading-tight">
              Learn in the way that fits you.
            </h2>
            <p className="text-lg md:text-xl text-muted-foreground leading-relaxed max-w-xl mx-auto lg:mx-0">
              You bring your story. We build the lesson around it — with tutoring and practice that
              reflect your culture, your learning style, and the goals that matter to you.
            </p>

            <div className="grid gap-4">
              {highlights.map((item) => (
                <div
                  key={item.title}
                  className="flex items-start gap-4 rounded-2xl border border-border/60 bg-card/60 p-4 text-left shadow-sm"
                >
                  <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <item.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-foreground">{item.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {item.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-6">
            <div className="rounded-3xl border border-border/70 bg-card p-6 shadow-sm">
              <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                What students feel
              </p>
              <p className="mt-4 text-2xl md:text-3xl font-display font-bold text-foreground leading-snug">
                “It feels like the lesson was made for me.”
              </p>
              <p className="mt-3 text-sm text-muted-foreground">
                A gentle, human approach that helps students feel seen and supported.
              </p>
            </div>

            <div className="rounded-3xl border border-border/60 bg-muted/20 p-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-2xl border border-border/60 bg-background p-4">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                    Your pace
                  </p>
                  <p className="mt-2 text-base font-semibold text-foreground">
                    Slow down, or speed up
                  </p>
                </div>
                <div className="rounded-2xl border border-border/60 bg-background p-4">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                    Your voice
                  </p>
                  <p className="mt-2 text-base font-semibold text-foreground">
                    Language that feels natural
                  </p>
                </div>
                <div className="rounded-2xl border border-border/60 bg-background p-4">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                    Your context
                  </p>
                  <p className="mt-2 text-base font-semibold text-foreground">
                    Examples that resonate
                  </p>
                </div>
                <div className="rounded-2xl border border-border/60 bg-background p-4">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                    Your goals
                  </p>
                  <p className="mt-2 text-base font-semibold text-foreground">
                    Support that sticks
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
