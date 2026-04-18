import Image from 'next/image';
import Link from 'next/link';
import { Montserrat } from 'next/font/google';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

const montserrat = Montserrat({ subsets: ['latin'], weight: ['900'] });

// ─── Service section data ────────────────────────────────────────────────────

const services = [
  {
    title: 'ENTRENAMIENTO',
    description: 'Planificación y seguimiento del desarrollo físico y técnico del atleta.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-10 h-10">
        <rect x="2" y="9" width="4" height="6" rx="1" />
        <rect x="18" y="9" width="4" height="6" rx="1" />
        <rect x="6" y="4" width="2" height="16" rx="1" />
        <rect x="16" y="4" width="2" height="16" rx="1" />
        <line x1="8" y1="12" x2="16" y2="12" />
      </svg>
    ),
  },
  {
    title: 'NUTRICIÓN',
    description: 'Estrategias alimenticias personalizadas para potenciar el desempeño.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-10 h-10">
        <path d="M12 2C8 2 4 6 4 10c0 4 2 7 5 8.5V22h6v-3.5C18 17 20 14 20 10c0-4-4-8-8-8z" />
        <path d="M12 2v10" />
        <path d="M9 6l3 4 3-4" />
      </svg>
    ),
  },
  {
    title: 'FISIOTERAPIA',
    description: 'Prevención, tratamiento y recuperación de lesiones musculares y articulares.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-10 h-10">
        <circle cx="12" cy="5" r="2" />
        <path d="M12 7v5l-3 4" />
        <path d="M12 12l3 4" />
        <path d="M9 11H6" />
        <path d="M18 11h-3" />
        <path d="M9 17l-2 4" />
        <path d="M15 17l2 4" />
      </svg>
    ),
  },
  {
    title: 'PSICOLOGÍA',
    description: 'Fortalecimiento mental para mejorar enfoque, disciplina y manejo de presión.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-10 h-10">
        <path d="M12 3C8.5 3 6 5.5 6 9c0 2.5 1.5 4.5 3.5 5.5V16h5v-1.5C16.5 13.5 18 11.5 18 9c0-3.5-2.5-6-6-6z" />
        <rect x="9.5" y="16" width="5" height="2" rx="0.5" />
        <rect x="10" y="18" width="4" height="2" rx="0.5" />
        <line x1="9" y1="9" x2="15" y2="9" />
        <line x1="12" y1="7" x2="12" y2="13" />
      </svg>
    ),
  },
  {
    title: 'MEDICINA',
    description: 'Supervisión integral de la salud del atleta con enfoque preventivo y clínico.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-10 h-10">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <line x1="12" y1="8" x2="12" y2="16" />
        <line x1="8" y1="12" x2="16" y2="12" />
      </svg>
    ),
  },
];

// ─── Benefits data ────────────────────────────────────────────────────────────

const benefits = [
  {
    title: 'Centraliza la información en un solo entorno',
    bullets: [
      'Integra todos los datos deportivos, médicos y operativos en una sola plataforma.',
      'Facilita el acceso, consulta y actualización de información en tiempo real.',
    ],
  },
  {
    title: 'Facilita el seguimiento individual por atleta',
    bullets: [
      'Permite monitorear la evolución de cada atleta de forma estructurada.',
      'Da visibilidad clara al desempeño, avances y áreas de mejora.',
    ],
  },
  {
    title: 'Mejora la coordinación entre áreas',
    bullets: [
      'Conecta a entrenadores, médicos y especialistas en un mismo sistema.',
      'Agiliza la comunicación y alinea las acciones del equipo multidisciplinario.',
    ],
  },
  {
    title: 'Optimiza el control de apoyos y recursos',
    bullets: [
      'Administra de forma ordenada los insumos, servicios y apoyos asignados.',
      'Evita duplicidades, omisiones y mejora el uso eficiente del presupuesto.',
    ],
  },
  {
    title: 'Genera información útil para decisiones estratégicas',
    bullets: [
      'Convierte datos en indicadores clave para la gestión del proyecto.',
      'Apoya la toma de decisiones con información clara y actualizada.',
    ],
  },
  {
    title: 'Fortalece la trazabilidad y el orden operativo',
    bullets: [
      'Registra cada acción, seguimiento y actividad dentro del sistema.',
      'Asegura control, transparencia y continuidad en la operación.',
    ],
  },
];

// ─── Platform features ───────────────────────────────────────────────────────

const platformFeatures = [
  'Registro integral de atletas',
  'Seguimiento por disciplina',
  'Control de staff especializado',
  'Gestión de apoyos y recursos',
  'Calendario de actividades y competencias',
  'Expediente médico y técnico',
  'Indicadores y reportes ejecutivos',
];

// ─── Page ────────────────────────────────────────────────────────────────────

export default async function LandingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  // Redirect authenticated users straight to the app
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'placeholder-anon-key',
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {},
      },
    },
  );
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect(`/${locale}/dashboard`);

  const loginHref = `/${locale}/login`;

  return (
    <div style={{ backgroundColor: '#fcfcef', fontFamily: 'sans-serif' }}>

      {/* ── 1. HEADER ────────────────────────────────────────────────────── */}
      <header className="bg-white border-b border-gray-100 px-8 py-5">
        <div className="max-w-6xl mx-auto flex items-center gap-4">
          <Image
            src="/logo.png"
            alt="AO Deportes"
            width={90}
            height={90}
            style={{ height: 'auto' }}
            priority
          />
          <span
            className={`${montserrat.className} font-black uppercase leading-none`}
            style={{ fontSize: '3rem', color: '#1a1a1a', letterSpacing: '-0.02em' }}
          >
            DEPORTE
            <span
              className={montserrat.className}
              style={{ fontSize: '1rem', fontWeight: 700, verticalAlign: 'super', marginLeft: '2px', color: '#7a7a7a' }}
            >
              .com
            </span>
          </span>
        </div>
      </header>

      {/* ── 2. HERO ──────────────────────────────────────────────────────── */}
      {/*
        Place your hero athlete photo at /public/hero.jpg
        The dark overlay ensures legibility even without the image.
      */}
      <section
        className="relative flex items-center justify-center overflow-hidden"
        style={{
          minHeight: '480px',
          backgroundImage: 'url(/hero.png)',
          backgroundSize: 'cover',
          backgroundPosition: 'center top',
          backgroundColor: '#111111',
        }}
      >
        <div className="absolute inset-0" style={{ backgroundColor: 'rgba(0,0,0,0.55)' }} />
      </section>

      {/* ── 3. CTA BAND ──────────────────────────────────────────────────── */}
      <div className="bg-white flex justify-center py-8">
        <Link
          href={loginHref}
          className="inline-block px-10 py-3 font-bold uppercase text-sm transition-all hover:bg-[#b4051e] hover:text-white"
          style={{
            border: '2px solid #b4051e',
            color: '#b4051e',
            letterSpacing: '0.15em',
          }}
        >
          ACCESO A ATLETAS
        </Link>
      </div>

      {/* ── 4. SERVICES ──────────────────────────────────────────────────── */}
      <section className="bg-white py-12 px-6 border-t" style={{ borderColor: '#e4e4e4' }}>
        <div className="max-w-6xl mx-auto grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-8">
          {services.map((s) => (
            <div key={s.title} className="flex flex-col items-center text-center gap-3">
              <div style={{ color: '#b4051e' }}>{s.icon}</div>
              <h3
                className="font-black text-sm uppercase tracking-wider"
                style={{ color: '#b4051e' }}
              >
                {s.title}
              </h3>
              <p className="text-xs leading-relaxed" style={{ color: '#7a7a7a' }}>
                {s.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── 5. OBJETIVOS ─────────────────────────────────────────────────── */}
      <section className="py-16 px-6" style={{ backgroundColor: '#e4e4e4' }}>
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
          <h2
            className="font-black uppercase leading-tight"
            style={{ fontSize: 'clamp(2.5rem, 5vw, 3.75rem)', color: '#b4051e' }}
          >
            OBJETIVOS
          </h2>
          <div className="flex flex-col gap-4">
            <p className="font-bold text-base leading-snug" style={{ color: '#b4051e' }}>
              El rendimiento de alto nivel también se construye con organización, seguimiento y
              visión integral
            </p>
            <p className="text-sm leading-relaxed" style={{ color: '#1a1a1a' }}>
              Nuestra plataforma centraliza la gestión de atletas y equipos multidisciplinarios
              para fortalecer la preparación deportiva, optimizar recursos y facilitar la toma de
              decisiones.
            </p>
          </div>
        </div>
      </section>

      {/* ── 6. NUESTRA PLATAFORMA ────────────────────────────────────────── */}
      <section className="bg-white py-16 px-6">
        <div className="max-w-6xl mx-auto flex flex-col gap-8">
          <h2
            className="font-black uppercase tracking-tight text-center"
            style={{ fontSize: 'clamp(2rem, 5vw, 3.5rem)', color: '#1a1a1a' }}
          >
            NUESTRA PLATAFORMA
          </h2>
          <p
            className="font-bold text-sm leading-relaxed max-w-3xl mx-auto text-center"
            style={{ color: '#1a1a1a' }}
          >
            La gestión de atletas de alto rendimiento requiere coordinación entre múltiples
            disciplinas, especialistas y apoyos operativos. Centralizar esta información permite
            mejorar el seguimiento, reducir omisiones y fortalecer la toma de decisiones.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-center mt-4">
            {/* Image — place /public/platform.jpg for a real photo */}
            <div
              className="rounded-lg overflow-hidden"
              style={{
                minHeight: '280px',
                backgroundImage: 'url(/Foto%202.png)',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                backgroundColor: '#e4e4e4',
              }}
            />
            <ul className="flex flex-col gap-3">
              {platformFeatures.map((f) => (
                <li key={f} className="flex items-start gap-3 text-sm" style={{ color: '#1a1a1a' }}>
                  <span
                    className="mt-1 w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: '#b4051e' }}
                  />
                  {f}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ── 7. BENEFICIOS ────────────────────────────────────────────────── */}
      <section className="py-16 px-6" style={{ backgroundColor: '#e4e4e4' }}>
        <div className="max-w-6xl mx-auto flex flex-col gap-10">
          <h2
            className="font-black uppercase tracking-tight text-right"
            style={{ fontSize: 'clamp(2rem, 5vw, 3.5rem)', color: '#b4051e' }}
          >
            BENEFICIOS
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-start">
            <div className="flex flex-col gap-5">
              {benefits.map((b) => (
                <div key={b.title}>
                  <p className="font-bold text-sm" style={{ color: '#b4051e' }}>
                    {b.title}
                  </p>
                  <ul className="mt-1 flex flex-col gap-1">
                    {b.bullets.map((bullet) => (
                      <li
                        key={bullet}
                        className="text-xs leading-relaxed pl-3"
                        style={{ color: '#1a1a1a', borderLeft: '2px solid #b4051e' }}
                      >
                        {bullet}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            {/* Image — place /public/benefits.jpg for a real photo */}
            <div
              className="rounded-lg overflow-hidden"
              style={{
                minHeight: '340px',
                backgroundImage: 'url(/Foto%201.png)',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                backgroundColor: '#c0c0c0',
              }}
            />
          </div>
        </div>
      </section>

      {/* ── 8. CONTACTO ──────────────────────────────────────────────────── */}
      <section className="bg-white py-16 px-6">
        <div className="max-w-2xl mx-auto flex flex-col gap-8">
          <h2
            className="font-black uppercase tracking-tight text-center"
            style={{ fontSize: 'clamp(2rem, 5vw, 3.5rem)', color: '#b4051e' }}
          >
            CONTACTO
          </h2>
          <div
            className="rounded-xl p-8 flex flex-col gap-5"
            style={{ backgroundColor: '#1a1a1a' }}
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                  Nombre
                </label>
                <input
                  type="text"
                  placeholder="Tu nombre"
                  className="rounded-md px-3 py-2 text-sm bg-gray-800 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:border-red-600"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                  Correo
                </label>
                <input
                  type="email"
                  placeholder="tu@email.com"
                  className="rounded-md px-3 py-2 text-sm bg-gray-800 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:border-red-600"
                />
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                Mensaje
              </label>
              <textarea
                rows={5}
                placeholder="¿En qué podemos ayudarte?"
                className="rounded-md px-3 py-2 text-sm bg-gray-800 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:border-red-600 resize-none"
              />
            </div>
            <button
              type="submit"
              className="self-end px-8 py-2.5 font-bold uppercase tracking-widest text-sm text-white transition-opacity hover:opacity-80"
              style={{ backgroundColor: '#b4051e' }}
            >
              Enviar
            </button>
          </div>
        </div>
      </section>

      {/* ── FOOTER ───────────────────────────────────────────────────────── */}
      <footer
        className="py-6 text-center text-xs"
        style={{ backgroundColor: '#1a1a1a', color: '#7a7a7a' }}
      >
        © {new Date().getFullYear()} AO Deportes. Todos los derechos reservados.
      </footer>
    </div>
  );
}
