import type { V2NodeFacts } from "@/lib/v2/types";

function SourceLinks({
  urls,
  context,
}: {
  urls: string[];
  context: string;
}) {
  return (
    <ul className="mt-3 flex flex-wrap gap-2" aria-label={`Sources for ${context}`}>
      {urls.map((url, index) => (
        <li key={url}>
          <a
            href={url}
            target="_blank"
            rel="noreferrer noopener"
            aria-label={`Source ${index + 1} for ${context}`}
            className="font-mono text-[10px] text-gray-500 underline underline-offset-2 hover:text-black"
          >
            Source {index + 1}
          </a>
        </li>
      ))}
    </ul>
  );
}

export default function NodeFacts({ facts }: { facts: V2NodeFacts }) {
  const reviewed = new Date(`${facts.last_reviewed}T00:00:00Z`).toLocaleDateString(
    "en-IN",
    { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" },
  );

  return (
    <section className="mt-10 border-t pt-8" aria-label="Career guide facts">
      {facts.quick_facts.length > 0 && (
        <section>
          <h2 className="font-mono text-sm font-bold">Quick facts</h2>
          <dl className="mt-4 grid gap-3 sm:grid-cols-2">
            {facts.quick_facts.map((fact) => (
              <div key={`${fact.label}:${fact.value}`} className="rounded-lg border bg-neutral-50 p-4">
                <dt className="font-mono text-[10px] uppercase tracking-wider text-gray-500">
                  {fact.label}
                </dt>
                <dd className="mt-1 text-sm font-medium">{fact.value}</dd>
                <SourceLinks urls={fact.source_urls} context={fact.label} />
              </div>
            ))}
          </dl>
        </section>
      )}

      <div className={facts.quick_facts.length ? "mt-10 space-y-10" : "space-y-10"}>
        {facts.sections.map((section) => (
          <section key={section.key}>
            <h3 className="text-xl font-bold">{section.heading}</h3>
            <div className="mt-3 space-y-3 text-sm leading-7 text-gray-700">
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
              {section.bullets.length > 0 && (
                <ul className="list-disc space-y-2 pl-5">
                  {section.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}
                </ul>
              )}
            </div>
            <SourceLinks urls={section.source_urls} context={section.heading} />
          </section>
        ))}
      </div>

      {facts.useful_links.length > 0 && (
        <section className="mt-10">
          <h2 className="font-mono text-sm font-bold">Useful links</h2>
          <ul className="mt-3 space-y-2">
            {facts.useful_links.map((link) => (
              <li key={link.url}>
                <a
                  href={link.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-sm underline underline-offset-2"
                >
                  {link.label}
                </a>
                <span className="ml-2 font-mono text-[9px] uppercase text-gray-400">
                  {link.kind}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="mt-10 font-mono text-[10px] text-gray-500">
        Last reviewed <time dateTime={facts.last_reviewed}>{reviewed}</time>
      </p>
    </section>
  );
}
