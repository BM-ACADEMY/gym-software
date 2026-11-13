// Public front page for a product. Shows only copy given by the product (from its LANDING.md) and says plainly that this is an
// invite-only pilot, so nothing reads as a proven claim. Buttons call onSignIn() and onJoin(); the product decides what they open.
export default function Landing({ name, tagline, headline, sub, blocks = [], steps = [], onSignIn, onJoin, brand }) {
  return (
    <div className="adm-land" style={brand ? { '--adm-brand': brand } : undefined}>
      <header className="adm-land-top">
        <b className="adm-land-name">{name}</b>
        <button type="button" className="adm-land-signin" onClick={onSignIn}>Sign in</button>
      </header>
      <section className="adm-land-hero">
        <p className="adm-land-pill">Invite-only pilot</p>
        <h1>{tagline}</h1>
        {headline && <p className="adm-land-lead">{headline}</p>}
        {sub && <p className="adm-land-sub">{sub}</p>}
        <div className="adm-land-cta">
          <button type="button" className="adm-go" onClick={onJoin}>Ask to join the pilot</button>
          <button type="button" className="adm-land-ghost" onClick={onSignIn}>I already have an account</button>
        </div>
        <p className="adm-land-small">We are testing {name} with a few businesses first. Prices are shown here only after we confirm them.</p>
      </section>
      {blocks.length > 0 && (
        <section className="adm-land-section">
          <h2>What {name} is built to do</h2>
          <p className="adm-land-note">These are the jobs we are testing with pilot businesses. We will say "works" only after an owner has seen it work.</p>
          <div className="adm-land-grid">
            {blocks.map((b) => <article key={b.title}><h3>{b.title}</h3><p>{b.text}</p></article>)}
          </div>
        </section>
      )}
      {steps.length > 0 && (
        <section className="adm-land-section">
          <h2>How it starts</h2>
          <ol className="adm-land-steps">{steps.map((s) => <li key={s}>{s}</li>)}</ol>
        </section>
      )}
      <footer className="adm-land-foot">
        <p>Afra Ventures Pvt Ltd, Puducherry. <a href="https://afraventures.in/terms">Terms</a> · <a href="https://afraventures.in/privacy">Privacy</a></p>
      </footer>
    </div>
  );
}
