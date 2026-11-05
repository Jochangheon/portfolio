export default function Links({ value }: { value: string }) {
  return (
    <>
      {value
        .split("\n")
        .filter(Boolean)
        .map((s, i) =>
          /^https?:\/\//.test(s) ? (
            <a
              className="external"
              key={i}
              href={s}
              target="_blank"
              rel="noreferrer"
            >
              {s} ↗
            </a>
          ) : (
            <p key={i}>{s}</p>
          ),
        )}
    </>
  );
}
