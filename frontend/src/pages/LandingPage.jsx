import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'

export default function LandingPage() {
  const phoneRef = useRef(null)

  useEffect(() => {
    // Animate chat bubbles on scroll
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('chat-visible')
          }
        })
      },
      { threshold: 0.2 }
    )
    document.querySelectorAll('.chat-bubble').forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [])

  return (
    <div className="landing-page">
      <style>{`
        /* ===== VARIABLES & BASE ===== */
        .landing-page {
          --salvia: #21D0B2;
          --salvia-dark: #1DCDFE;
          --salvia-light: #E6FAF8;
          --menta: #34F5C6;
          --fondo: #F4FBFB;
          --negro: #2F455C;
          --gris: #4A6580;
          --blanco: #FFFFFF;

          font-family: 'Geist', 'Inter', system-ui, sans-serif;
          color: var(--negro);
          background: var(--fondo);
          overflow-x: hidden;
          line-height: 1.6;
        }
        .landing-page * { box-sizing: border-box; margin: 0; padding: 0; }

        /* ===== TYPOGRAPHY ===== */
        .landing-page h1, .landing-page h2, .landing-page h3 {
          font-family: 'Fraunces', 'Georgia', serif;
          font-weight: 700;
          line-height: 1.15;
          color: var(--negro);
        }
        .landing-page h1 { font-size: clamp(2.2rem, 5vw, 3.4rem); }
        .landing-page h2 { font-size: clamp(1.6rem, 3.5vw, 2.4rem); }
        .landing-page p { color: var(--gris); font-size: 1.05rem; }

        /* ===== BUTTONS ===== */
        .btn-primary {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: var(--salvia);
          color: white;
          font-weight: 600;
          font-size: 1rem;
          padding: 14px 32px;
          border-radius: 50px;
          border: none;
          cursor: pointer;
          text-decoration: none;
          transition: all 0.3s ease;
          box-shadow: 0 4px 15px rgba(33, 208, 178, 0.3);
          font-family: 'Geist', 'Inter', system-ui, sans-serif;
        }
        .btn-primary:hover {
          background: #1bb89c;
          transform: translateY(-2px);
          box-shadow: 0 6px 25px rgba(33, 208, 178, 0.4);
        }
        .btn-secondary {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: transparent;
          color: var(--salvia);
          font-weight: 600;
          font-size: 0.95rem;
          padding: 12px 28px;
          border-radius: 50px;
          border: 2px solid var(--salvia);
          cursor: pointer;
          text-decoration: none;
          transition: all 0.3s ease;
          font-family: 'Geist', 'Inter', system-ui, sans-serif;
        }
        .btn-secondary:hover {
          background: var(--salvia-light);
        }

        /* ===== NAV ===== */
        .landing-nav {
          position: fixed;
          top: 0; left: 0; right: 0;
          z-index: 100;
          padding: 16px 32px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: rgba(244, 251, 251, 0.85);
          backdrop-filter: blur(20px);
          border-bottom: 1px solid rgba(33, 208, 178, 0.1);
        }
        .landing-nav-logo {
          font-family: 'Fraunces', serif;
          font-weight: 800;
          font-size: 1.3rem;
          color: var(--negro);
          display: flex;
          align-items: center;
          gap: 8px;
          text-decoration: none;
        }
        .landing-nav-logo span { font-size: 1.4rem; }

        /* ===== HERO ===== */
        .hero-section {
          padding: 140px 32px 80px;
          max-width: 1200px;
          margin: 0 auto;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 60px;
          align-items: center;
        }
        .hero-chip {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: var(--salvia-light);
          color: var(--salvia);
          font-weight: 600;
          font-size: 0.8rem;
          padding: 6px 14px;
          border-radius: 50px;
          margin-bottom: 20px;
          letter-spacing: 0.02em;
        }
        .hero-subtitle {
          font-size: 1.15rem;
          color: var(--gris);
          margin: 20px 0 32px;
          max-width: 480px;
          line-height: 1.7;
        }
        .hero-stats {
          display: flex;
          gap: 32px;
          margin-top: 40px;
        }
        .hero-stat {
          text-align: center;
        }
        .hero-stat-number {
          font-family: 'Fraunces', serif;
          font-size: 1.8rem;
          font-weight: 800;
          color: var(--salvia);
        }
        .hero-stat-label {
          font-size: 0.75rem;
          color: var(--gris);
          margin-top: 2px;
        }

        /* ===== PHONE MOCKUP ===== */
        .phone-mockup {
          width: 300px;
          margin: 0 auto;
          background: #fff;
          border-radius: 32px;
          box-shadow: 0 25px 60px rgba(47, 69, 92, 0.15), 0 0 0 1px rgba(0,0,0,0.05);
          overflow: hidden;
          position: relative;
        }
        .phone-header {
          background: #075E54;
          color: white;
          padding: 14px 16px 10px;
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .phone-header-avatar {
          width: 36px;
          height: 36px;
          background: var(--salvia);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
        }
        .phone-header-name {
          font-weight: 600;
          font-size: 0.95rem;
        }
        .phone-header-status {
          font-size: 0.7rem;
          opacity: 0.8;
        }
        .phone-chat {
          background: #ECE5DD;
          padding: 16px 12px;
          min-height: 340px;
          display: flex;
          flex-direction: column;
          gap: 8px;
          background-image: url("data:image/svg+xml,%3Csvg width='60' height='60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M30 0L60 30L30 60L0 30Z' fill='%23d4cec4' opacity='0.08'/%3E%3C/svg%3E");
        }
        .chat-bubble {
          max-width: 85%;
          padding: 8px 12px;
          border-radius: 8px;
          font-size: 0.82rem;
          line-height: 1.45;
          position: relative;
          opacity: 0;
          transform: translateY(10px);
          transition: all 0.5s ease;
        }
        .chat-bubble.chat-visible {
          opacity: 1;
          transform: translateY(0);
        }
        .chat-bubble:nth-child(2) { transition-delay: 0.3s; }
        .chat-bubble:nth-child(3) { transition-delay: 0.6s; }
        .chat-bubble:nth-child(4) { transition-delay: 0.9s; }
        .chat-bubble:nth-child(5) { transition-delay: 1.2s; }
        .bubble-incoming {
          background: white;
          align-self: flex-start;
          border-bottom-left-radius: 2px;
          color: var(--negro);
        }
        .bubble-outgoing {
          background: #DCF8C6;
          align-self: flex-end;
          border-bottom-right-radius: 2px;
          color: var(--negro);
        }
        .bubble-time {
          font-size: 0.6rem;
          color: #999;
          text-align: right;
          margin-top: 3px;
        }
        .bubble-sender {
          font-size: 0.68rem;
          font-weight: 600;
          color: var(--salvia);
          margin-bottom: 2px;
        }

        /* ===== VENTAJAS BAR ===== */
        .ventajas-bar {
          background: var(--negro);
          padding: 28px 32px;
          overflow: hidden;
        }
        .ventajas-track {
          display: flex;
          gap: 48px;
          animation: scroll-ventajas 30s linear infinite;
          width: max-content;
        }
        @keyframes scroll-ventajas {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .ventaja-item {
          display: flex;
          align-items: center;
          gap: 8px;
          white-space: nowrap;
          color: rgba(255,255,255,0.9);
          font-size: 0.85rem;
          font-weight: 500;
        }
        .ventaja-icon {
          font-size: 1.1rem;
        }

        /* ===== SECTIONS COMMON ===== */
        .section {
          padding: 80px 32px;
          max-width: 1100px;
          margin: 0 auto;
        }
        .section-label {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 0.75rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          color: var(--salvia);
          margin-bottom: 12px;
        }
        .section-desc {
          font-size: 1.05rem;
          color: var(--gris);
          max-width: 580px;
          margin-top: 12px;
          line-height: 1.7;
        }

        /* ===== PROBLEMA ===== */
        .problema-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 60px;
          align-items: center;
          margin-top: 48px;
        }
        .pain-point {
          display: flex;
          gap: 14px;
          margin-bottom: 24px;
        }
        .pain-icon {
          width: 40px;
          height: 40px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.1rem;
          flex-shrink: 0;
        }
        .pain-icon-red { background: #FEE2E2; }
        .pain-icon-yellow { background: #FEF3C7; }
        .pain-icon-orange { background: #FFEDD5; }
        .pain-title { font-weight: 600; font-size: 0.95rem; color: var(--negro); }
        .pain-desc { font-size: 0.85rem; color: var(--gris); margin-top: 2px; }

        .chaos-phone {
          width: 280px;
          margin: 0 auto;
          background: #fff;
          border-radius: 28px;
          box-shadow: 0 20px 50px rgba(47, 69, 92, 0.12);
          overflow: hidden;
        }
        .chaos-header {
          background: #075E54;
          color: white;
          padding: 12px 16px;
          font-weight: 600;
          font-size: 0.9rem;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .chaos-chat {
          background: #ECE5DD;
          padding: 14px 10px;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .chaos-bubble {
          padding: 7px 10px;
          border-radius: 7px;
          font-size: 0.75rem;
          line-height: 1.4;
        }
        .chaos-left {
          background: white;
          align-self: flex-start;
          max-width: 80%;
        }
        .chaos-right {
          background: #DCF8C6;
          align-self: flex-end;
          max-width: 80%;
        }
        .chaos-red { background: #FEE2E2; border: 1px solid #FECACA; color: #991B1B; }

        /* ===== CÓMO FUNCIONA ===== */
        .steps-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 32px;
          margin-top: 48px;
        }
        .step-card {
          background: white;
          border-radius: 20px;
          padding: 32px 28px;
          text-align: center;
          box-shadow: 0 4px 20px rgba(47, 69, 92, 0.06);
          border: 1px solid rgba(33, 208, 178, 0.1);
          transition: all 0.3s ease;
        }
        .step-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 12px 35px rgba(47, 69, 92, 0.1);
        }
        .step-number {
          width: 48px;
          height: 48px;
          background: linear-gradient(135deg, var(--salvia), var(--menta));
          color: white;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: 'Fraunces', serif;
          font-weight: 800;
          font-size: 1.2rem;
          margin: 0 auto 16px;
        }
        .step-emoji {
          font-size: 2rem;
          margin-bottom: 12px;
        }
        .step-title {
          font-family: 'Fraunces', serif;
          font-weight: 700;
          font-size: 1.1rem;
          color: var(--negro);
          margin-bottom: 8px;
        }
        .step-desc {
          font-size: 0.88rem;
          color: var(--gris);
          line-height: 1.6;
        }

        /* ===== DEMO ===== */
        .demo-section {
          background: white;
          border-radius: 24px;
          padding: 60px 48px;
          margin: 60px auto;
          max-width: 1100px;
          box-shadow: 0 8px 30px rgba(47, 69, 92, 0.06);
          border: 1px solid rgba(33, 208, 178, 0.08);
        }
        .demo-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 48px;
          align-items: start;
          margin-top: 36px;
        }
        .demo-form {
          background: var(--fondo);
          border-radius: 16px;
          padding: 28px;
          border: 1px solid rgba(33, 208, 178, 0.15);
        }
        .demo-form-title {
          font-family: 'Fraunces', serif;
          font-weight: 700;
          font-size: 1.1rem;
          margin-bottom: 20px;
          color: var(--negro);
        }
        .demo-field {
          margin-bottom: 16px;
        }
        .demo-field label {
          display: block;
          font-size: 0.8rem;
          font-weight: 600;
          color: var(--negro);
          margin-bottom: 6px;
        }
        .demo-field input, .demo-field select {
          width: 100%;
          padding: 10px 14px;
          border: 1.5px solid #e2e8f0;
          border-radius: 10px;
          font-size: 0.88rem;
          background: white;
          color: var(--negro);
          transition: border-color 0.2s;
          font-family: 'Geist', 'Inter', system-ui, sans-serif;
        }
        .demo-field input:focus, .demo-field select:focus {
          outline: none;
          border-color: var(--salvia);
          box-shadow: 0 0 0 3px rgba(33, 208, 178, 0.1);
        }
        .demo-explain {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }
        .demo-explain-item {
          display: flex;
          gap: 14px;
          align-items: flex-start;
        }
        .demo-explain-icon {
          width: 36px;
          height: 36px;
          background: var(--salvia-light);
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1rem;
          flex-shrink: 0;
        }
        .demo-explain-title {
          font-weight: 600;
          font-size: 0.9rem;
          color: var(--negro);
        }
        .demo-explain-desc {
          font-size: 0.82rem;
          color: var(--gris);
          margin-top: 2px;
          line-height: 1.5;
        }

        /* ===== PARA QUIÉN ===== */
        .audience-card {
          background: white;
          border-radius: 20px;
          padding: 40px;
          margin-top: 40px;
          box-shadow: 0 4px 20px rgba(47, 69, 92, 0.06);
        }
        .audience-tags {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin-top: 24px;
        }
        .audience-tag {
          background: var(--salvia-light);
          color: var(--salvia);
          font-size: 0.8rem;
          font-weight: 600;
          padding: 8px 16px;
          border-radius: 50px;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        /* ===== PRECIO ===== */
        .precio-card {
          background: var(--negro);
          border-radius: 24px;
          padding: 48px;
          max-width: 500px;
          margin: 48px auto 0;
          text-align: center;
          position: relative;
          overflow: hidden;
        }
        .precio-card::before {
          content: '';
          position: absolute;
          top: -50%;
          left: -50%;
          width: 200%;
          height: 200%;
          background: radial-gradient(ellipse at center, rgba(33, 208, 178, 0.1) 0%, transparent 70%);
          pointer-events: none;
        }
        .precio-badge {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          background: rgba(33, 208, 178, 0.15);
          color: var(--menta);
          font-size: 0.75rem;
          font-weight: 700;
          padding: 6px 14px;
          border-radius: 50px;
          margin-bottom: 20px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .precio-amount {
          font-family: 'Fraunces', serif;
          font-size: 3.5rem;
          font-weight: 800;
          color: white;
          margin-bottom: 4px;
        }
        .precio-period {
          color: rgba(255,255,255,0.5);
          font-size: 1.1rem;
          margin-bottom: 8px;
        }
        .precio-old {
          color: rgba(255,255,255,0.35);
          font-size: 0.9rem;
          text-decoration: line-through;
          margin-bottom: 28px;
        }
        .precio-features {
          list-style: none;
          padding: 0;
          margin-bottom: 32px;
          text-align: left;
        }
        .precio-features li {
          display: flex;
          align-items: center;
          gap: 10px;
          color: rgba(255,255,255,0.85);
          font-size: 0.9rem;
          margin-bottom: 12px;
        }
        .precio-check {
          width: 20px;
          height: 20px;
          background: rgba(33, 208, 178, 0.2);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--menta);
          font-size: 0.7rem;
          flex-shrink: 0;
        }

        /* ===== CTA FINAL ===== */
        .cta-final {
          text-align: center;
          padding: 80px 32px;
          max-width: 700px;
          margin: 0 auto;
        }
        .cta-final h2 {
          margin-bottom: 16px;
        }
        .cta-final p {
          margin-bottom: 32px;
        }

        /* ===== FOOTER ===== */
        .landing-footer {
          text-align: center;
          padding: 40px 32px;
          border-top: 1px solid rgba(33, 208, 178, 0.1);
        }
        .landing-footer-brand {
          font-family: 'Fraunces', serif;
          font-weight: 800;
          font-size: 1.1rem;
          color: var(--negro);
          margin-bottom: 4px;
        }
        .landing-footer p {
          font-size: 0.8rem;
          color: var(--gris);
        }

        /* ===== RESPONSIVE ===== */
        @media (max-width: 768px) {
          .hero-section {
            grid-template-columns: 1fr;
            padding: 120px 20px 60px;
            gap: 40px;
            text-align: center;
          }
          .hero-subtitle { margin: 16px auto 24px; }
          .hero-stats { justify-content: center; gap: 24px; }
          .problema-grid { grid-template-columns: 1fr; gap: 40px; }
          .steps-grid { grid-template-columns: 1fr; }
          .demo-section { padding: 32px 20px; margin: 40px 16px; }
          .demo-grid { grid-template-columns: 1fr; }
          .landing-nav { padding: 12px 16px; }
          .section { padding: 60px 20px; }
          .precio-card { padding: 32px 24px; margin: 32px 16px 0; }
          .audience-card { padding: 28px 20px; }
        }
      `}</style>

      {/* ===== NAV ===== */}
      <nav className="landing-nav">
        <a href="/" className="landing-nav-logo">
          <span>🧹</span> AseoAlerta
        </a>
        <Link to="/login" className="btn-primary" style={{ padding: '10px 24px', fontSize: '0.88rem' }}>
          Quiero probarlo →
        </Link>
      </nav>

      {/* ===== HERO ===== */}
      <section className="hero-section">
        <div>
          <div className="hero-chip">
            🇨🇱 Hecho para Chile — Airbnb &amp; Booking
          </div>
          <h1>Tu hospedaje siempre listo.<br />Sin llamadas.</h1>
          <p className="hero-subtitle">
            Conecta tu calendario de reservas y AseoAlerta avisa automáticamente por WhatsApp
            a tu encargada de aseo antes de cada check-in. Sin apps nuevas, sin estrés.
          </p>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <Link to="/login" className="btn-primary">
              Comenzar gratis →
            </Link>
          </div>
          <div className="hero-stats">
            <div className="hero-stat">
              <div className="hero-stat-number">3</div>
              <div className="hero-stat-label">avisos automáticos</div>
            </div>
            <div className="hero-stat">
              <div className="hero-stat-number">0</div>
              <div className="hero-stat-label">apps que instalar</div>
            </div>
            <div className="hero-stat">
              <div className="hero-stat-number">5 min</div>
              <div className="hero-stat-label">para configurar</div>
            </div>
          </div>
        </div>

        {/* Phone mockup */}
        <div ref={phoneRef}>
          <div className="phone-mockup">
            <div className="phone-header">
              <div className="phone-header-avatar">🧹</div>
              <div>
                <div className="phone-header-name">AseoAlerta</div>
                <div className="phone-header-status">en línea</div>
              </div>
            </div>
            <div className="phone-chat">
              <div className="chat-bubble bubble-incoming">
                <div className="bubble-sender">AseoAlerta</div>
                🏠 <strong>Nueva reserva detectada</strong><br />
                Propiedad: Depto Bellavista<br />
                Check-out: Mañana 11:00<br />
                Check-in: Mañana 15:00
                <div className="bubble-time">10:30 AM</div>
              </div>
              <div className="chat-bubble bubble-incoming">
                <div className="bubble-sender">AseoAlerta</div>
                🧹 Por favor preparar limpieza completa para mañana entre 11:00 y 15:00.
                <div className="bubble-time">10:30 AM</div>
              </div>
              <div className="chat-bubble bubble-outgoing">
                ¡Listo! Llego a las 11:30 ✅
                <div className="bubble-time">10:45 AM</div>
              </div>
              <div className="chat-bubble bubble-incoming">
                <div className="bubble-sender">AseoAlerta</div>
                ✅ Confirmado. La encargada llega a las 11:30.
                <div className="bubble-time">10:45 AM</div>
              </div>
              <div className="chat-bubble bubble-incoming">
                <div className="bubble-sender">AseoAlerta</div>
                📋 <strong>Recordatorio</strong>: Toallas extra para 4 huéspedes.
                <div className="bubble-time">10:46 AM</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== VENTAJAS BAR ===== */}
      <div className="ventajas-bar">
        <div className="ventajas-track">
          {[...Array(2)].map((_, i) => (
            <div key={i} style={{ display: 'flex', gap: '48px' }}>
              <div className="ventaja-item"><span className="ventaja-icon">💬</span> Solo WhatsApp — sin apps nuevas</div>
              <div className="ventaja-item"><span className="ventaja-icon">🇨🇱</span> En español para Chile</div>
              <div className="ventaja-item"><span className="ventaja-icon">💰</span> $0/mes — 100% gratis</div>
              <div className="ventaja-item"><span className="ventaja-icon">📱</span> Tu encargada no instala nada</div>
              <div className="ventaja-item"><span className="ventaja-icon">✅</span> El WhatsApp que ya usan</div>
            </div>
          ))}
        </div>
      </div>

      {/* ===== PROBLEMA ===== */}
      <section className="section">
        <div className="section-label">😩 EL PROBLEMA</div>
        <h2>La coordinación es un caos</h2>
        <p className="section-desc">
          Mensajes perdidos, limpieza a destiempo, huéspedes que llegan a un departamento sucio.
          ¿Te suena?
        </p>
        <div className="problema-grid">
          <div>
            <div className="pain-point">
              <div className="pain-icon pain-icon-red">😤</div>
              <div>
                <div className="pain-title">"¿Le avisaste a la Sra. María?"</div>
                <div className="pain-desc">Llamar, mandar mensajes, confirmar... cada reserva es un trámite.</div>
              </div>
            </div>
            <div className="pain-point">
              <div className="pain-icon pain-icon-yellow">⏰</div>
              <div>
                <div className="pain-title">"Se nos olvidó el check-out de hoy"</div>
                <div className="pain-desc">Cuando tienes 3+ propiedades, algo siempre se escapa.</div>
              </div>
            </div>
            <div className="pain-point">
              <div className="pain-icon pain-icon-orange">😡</div>
              <div>
                <div className="pain-title">"El huésped llegó y no estaba limpio"</div>
                <div className="pain-desc">La peor pesadilla. Mala reseña asegurada.</div>
              </div>
            </div>
          </div>
          <div>
            <div className="chaos-phone">
              <div className="chaos-header">
                <span>😫</span> WhatsApp grupal típico
              </div>
              <div className="chaos-chat">
                <div className="chaos-bubble chaos-left">Oye necesito limpieza para mañana en el depto de Ñuñoa</div>
                <div className="chaos-bubble chaos-right">¿A qué hora?</div>
                <div className="chaos-bubble chaos-left">Tipo 11 creo, déjame ver...</div>
                <div className="chaos-bubble chaos-left">En verdad era el otro depto</div>
                <div className="chaos-bubble chaos-right">🤔 Entonces cuál?</div>
                <div className="chaos-bubble chaos-red">❌ Mensaje no leído — 3 horas</div>
                <div className="chaos-bubble chaos-left">Perdón! El de Provi, check-out a las 11</div>
                <div className="chaos-bubble chaos-right">Ya no puedo, era para avisarme antes 😤</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== CÓMO FUNCIONA ===== */}
      <section className="section" style={{ textAlign: 'center' }}>
        <div className="section-label">⚡ CÓMO FUNCIONA</div>
        <h2>3 pasos. 5 minutos. Listo.</h2>
        <p className="section-desc" style={{ margin: '12px auto 0' }}>
          Sin instalar nada. Sin configuraciones complicadas.
        </p>
        <div className="steps-grid">
          <div className="step-card">
            <div className="step-number">1</div>
            <div className="step-emoji">📅</div>
            <div className="step-title">Conecta tu calendario</div>
            <div className="step-desc">
              Pega el link iCal de tu Airbnb o Booking. AseoAlerta detecta cada reserva automáticamente.
            </div>
          </div>
          <div className="step-card">
            <div className="step-number">2</div>
            <div className="step-emoji">👩‍🔧</div>
            <div className="step-title">Agrega a tu encargada</div>
            <div className="step-desc">
              Solo necesitas su número de WhatsApp. Ella no instala nada ni crea cuenta.
            </div>
          </div>
          <div className="step-card">
            <div className="step-number">3</div>
            <div className="step-emoji">✨</div>
            <div className="step-title">Funciona solo</div>
            <div className="step-desc">
              Antes de cada check-in, tu encargada recibe un WhatsApp con todos los detalles. Tú no haces nada.
            </div>
          </div>
        </div>
      </section>

      {/* ===== DEMO ===== */}
      <div className="demo-section">
        <div style={{ textAlign: 'center' }}>
          <div className="section-label">🖥️ PRODUCTO</div>
          <h2>Así se ve por dentro</h2>
          <p className="section-desc" style={{ margin: '12px auto 0' }}>
            Un panel simple donde configuras tus propiedades en minutos.
          </p>
        </div>
        <div className="demo-grid">
          <div className="demo-form">
            <div className="demo-form-title">➕ Agregar propiedad</div>
            <div className="demo-field">
              <label>Nombre de la propiedad</label>
              <input type="text" placeholder="Ej: Depto Bellavista" readOnly />
            </div>
            <div className="demo-field">
              <label>Link calendario iCal</label>
              <input type="text" placeholder="https://airbnb.com/calendar/ical/..." readOnly />
            </div>
            <div className="demo-field">
              <label>WhatsApp encargada de aseo</label>
              <input type="text" placeholder="+56 9 1234 5678" readOnly />
            </div>
            <div className="demo-field">
              <label>¿Cuándo avisar?</label>
              <select disabled>
                <option>El día anterior al check-in</option>
              </select>
            </div>
            <Link
              to="/login"
              className="btn-primary"
              style={{ width: '100%', justifyContent: 'center', marginTop: '8px' }}
            >
              Probar ahora — es gratis
            </Link>
          </div>
          <div className="demo-explain">
            <h3 style={{ fontFamily: "'Fraunces', serif", fontSize: '1.2rem', color: 'var(--negro)', marginBottom: '8px' }}>
              ¿Qué pasa después de activar?
            </h3>
            <div className="demo-explain-item">
              <div className="demo-explain-icon">📅</div>
              <div>
                <div className="demo-explain-title">Detectamos reservas</div>
                <div className="demo-explain-desc">Revisamos tu calendario cada hora buscando nuevos check-outs.</div>
              </div>
            </div>
            <div className="demo-explain-item">
              <div className="demo-explain-icon">📱</div>
              <div>
                <div className="demo-explain-title">Avisamos por WhatsApp</div>
                <div className="demo-explain-desc">Tu encargada recibe fecha, hora y detalles del aseo.</div>
              </div>
            </div>
            <div className="demo-explain-item">
              <div className="demo-explain-icon">✅</div>
              <div>
                <div className="demo-explain-title">Confirma y listo</div>
                <div className="demo-explain-desc">Ella responde por WhatsApp. Tú ves la confirmación en el panel.</div>
              </div>
            </div>
            <div className="demo-explain-item">
              <div className="demo-explain-icon">🔁</div>
              <div>
                <div className="demo-explain-title">Automático siempre</div>
                <div className="demo-explain-desc">Cada nueva reserva genera un aviso sin que hagas nada.</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ===== PARA QUIÉN ===== */}
      <section className="section">
        <div className="section-label">🎯 PARA QUIÉN</div>
        <h2>¿Tienes un hospedaje en Airbnb o Booking?</h2>
        <p className="section-desc">
          AseoAlerta es para dueños y administradores de hospedajes que quieren dejar de
          coordinar la limpieza a mano.
        </p>
        <div className="audience-card">
          <h3 style={{ fontFamily: "'Fraunces', serif", fontSize: '1.15rem', color: 'var(--negro)' }}>
            Perfecto si tienes propiedades en:
          </h3>
          <div className="audience-tags">
            {['🏔️ Pucón', '🏄 Pichilemu', '⛰️ Cajón del Maipo', '🏖️ Viña del Mar', '🌊 La Serena',
              '🏙️ Santiago Centro', '🌲 Puerto Varas', '🏠 Valparaíso', '🌴 Reñaca', '🌄 San Pedro de Atacama'
            ].map((dest) => (
              <span className="audience-tag" key={dest}>{dest}</span>
            ))}
          </div>
          <p style={{ marginTop: '24px', fontSize: '0.9rem', color: 'var(--gris)' }}>
            También funciona para cualquier arriendo temporal en Chile con calendario iCal.
          </p>
        </div>
      </section>

      {/* ===== PRECIO ===== */}
      <section className="section" style={{ textAlign: 'center' }}>
        <div className="section-label">💰 PRECIO</div>
        <h2>Simple y transparente</h2>
        <div className="precio-card">
          <div className="precio-badge">🎉 Acceso anticipado gratuito</div>
          <div className="precio-amount">$0</div>
          <div className="precio-period">/ mes</div>
          <div className="precio-old">$14.990/mes</div>
          <ul className="precio-features">
            <li><span className="precio-check">✓</span> Propiedades ilimitadas</li>
            <li><span className="precio-check">✓</span> Alertas WhatsApp automáticas</li>
            <li><span className="precio-check">✓</span> Sincronización de calendarios</li>
            <li><span className="precio-check">✓</span> Panel de control completo</li>
            <li><span className="precio-check">✓</span> Soporte por WhatsApp</li>
            <li><span className="precio-check">✓</span> Sin tarjeta de crédito</li>
          </ul>
          <Link
            to="/login"
            className="btn-primary"
            style={{ width: '100%', justifyContent: 'center', background: 'var(--salvia)' }}
          >
            Empezar gratis →
          </Link>
        </div>
      </section>

      {/* ===== CTA FINAL ===== */}
      <section className="cta-final">
        <h2>¿Tu hospedaje tiene reservas este fin de semana?</h2>
        <p style={{ fontSize: '1.1rem', color: 'var(--gris)' }}>
          Configura AseoAlerta en 5 minutos y deja que la coordinación se haga sola.
        </p>
        <Link to="/login" className="btn-primary" style={{ fontSize: '1.05rem', padding: '16px 36px' }}>
          Comenzar gratis →
        </Link>
      </section>

      {/* ===== FOOTER ===== */}
      <footer className="landing-footer">
        <div className="landing-footer-brand">🧹 AseoAlerta</div>
        <p>Hecho en Chile 🇨🇱</p>
      </footer>
    </div>
  )
}
