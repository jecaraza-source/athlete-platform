import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { Montserrat } from 'next/font/google';

const montserrat = Montserrat({ subsets: ['latin'], weight: ['900'] });

export const metadata: Metadata = {
  title: 'Aviso de Privacidad | AO Deportes',
  description: 'Aviso de privacidad y tratamiento de datos personales de AO Deportes.',
};

const content = {
  es: {
    title: 'Aviso de Privacidad',
    lastUpdated: 'Última actualización: abril de 2026',
    sections: [
      {
        heading: '1. Responsable del Tratamiento de Datos',
        body: `AO Deportes ("nosotros", "la plataforma") es responsable del tratamiento de los datos personales que usted nos proporciona a través de la aplicación móvil AO Deportes y del sitio web aodeporte.com.`,
      },
      {
        heading: '2. Datos Personales que Recopilamos',
        body: `Podemos recopilar y tratar las siguientes categorías de datos personales:

• Datos de identificación: nombre completo, correo electrónico, número de teléfono.
• Datos deportivos: disciplina, categoría, resultados y métricas de rendimiento.
• Datos de salud: información médica, nutricional, fisioterapéutica y psicológica registrada por el staff especializado.
• Datos de uso: interacciones dentro de la plataforma, registros de acceso y preferencias.
• Fotografías y archivos multimedia: imágenes de perfil y documentos adjuntos cargados en la plataforma.`,
      },
      {
        heading: '3. Finalidades del Tratamiento',
        body: `Sus datos personales se utilizan para:

• Gestionar su registro y cuenta dentro de la plataforma.
• Proveer seguimiento integral del desarrollo deportivo, médico, nutricional y psicológico del atleta.
• Facilitar la comunicación entre atletas, entrenadores y staff especializado.
• Generar reportes e indicadores de desempeño.
• Enviar notificaciones relevantes relacionadas con su plan de entrenamiento y actividades.
• Cumplir con obligaciones legales aplicables.`,
      },
      {
        heading: '4. Fundamento Legal',
        body: `El tratamiento de sus datos se basa en:

• Su consentimiento explícito al registrarse en la plataforma.
• La ejecución de la relación contractual/deportiva entre el atleta y la organización.
• El cumplimiento de obligaciones legales.
• Nuestros intereses legítimos en la mejora y operación de la plataforma.`,
      },
      {
        heading: '5. Conservación de los Datos',
        body: `Sus datos personales se conservarán durante el tiempo que mantenga una cuenta activa en la plataforma, y por el período adicional que resulte necesario para cumplir con obligaciones legales o resolver disputas. Los datos de salud se conservan conforme a los plazos establecidos por la normativa sanitaria aplicable.`,
      },
      {
        heading: '6. Compartición de Datos',
        body: `No vendemos ni cedemos sus datos personales a terceros con fines comerciales. Podemos compartir sus datos con:

• Personal autorizado de la plataforma (entrenadores, médicos, nutriólogos y demás staff registrado).
• Proveedores de tecnología que nos apoyan en la operación del servicio (Supabase para almacenamiento y autenticación, Vercel para hospedaje), sujetos a acuerdos de confidencialidad.
• Autoridades competentes cuando sea requerido por ley.`,
      },
      {
        heading: '7. Seguridad de los Datos',
        body: `Implementamos medidas técnicas y organizativas adecuadas para proteger sus datos personales contra acceso no autorizado, pérdida, destrucción o alteración. Esto incluye cifrado en tránsito (TLS), control de acceso basado en roles y autenticación segura.`,
      },
      {
        heading: '8. Sus Derechos',
        body: `De acuerdo con la legislación aplicable, usted tiene derecho a:

• Acceder a sus datos personales.
• Rectificar datos inexactos o incompletos.
• Solicitar la supresión de sus datos (derecho al olvido).
• Oponerse al tratamiento de sus datos.
• Solicitar la portabilidad de sus datos.
• Retirar su consentimiento en cualquier momento.

Para ejercer estos derechos, contacte a: privacidad@aodeporte.com`,
      },
      {
        heading: '9. Datos de Menores',
        body: `La plataforma puede ser utilizada por atletas menores de edad bajo supervisión y con el consentimiento expreso de sus padres o tutores legales. Si usted es padre o tutor y tiene alguna inquietud sobre el tratamiento de datos de un menor, contáctenos de inmediato.`,
      },
      {
        heading: '10. Cambios a este Aviso',
        body: `Podemos actualizar este Aviso de Privacidad periódicamente. Le notificaremos sobre cambios significativos mediante un aviso visible en la aplicación o por correo electrónico. Le recomendamos revisar este aviso con regularidad.`,
      },
      {
        heading: '11. Contacto',
        body: `Si tiene preguntas o inquietudes sobre el tratamiento de sus datos personales, puede contactarnos en:

AO Deportes
Correo: privacidad@aodeporte.com
Sitio web: aodeporte.com`,
      },
    ],
  },
  en: {
    title: 'Privacy Notice',
    lastUpdated: 'Last updated: April 2026',
    sections: [
      {
        heading: '1. Data Controller',
        body: `AO Deportes ("we", "the platform") is responsible for processing the personal data you provide through the AO Deportes mobile application and the website aodeporte.com.`,
      },
      {
        heading: '2. Personal Data We Collect',
        body: `We may collect and process the following categories of personal data:

• Identification data: full name, email address, phone number.
• Sports data: discipline, category, results and performance metrics.
• Health data: medical, nutritional, physiotherapy and psychological information recorded by the specialized staff.
• Usage data: interactions within the platform, access logs and preferences.
• Photos and multimedia files: profile pictures and documents uploaded to the platform.`,
      },
      {
        heading: '3. Purposes of Processing',
        body: `Your personal data is used to:

• Manage your registration and account within the platform.
• Provide comprehensive tracking of the athlete's sports, medical, nutritional and psychological development.
• Facilitate communication between athletes, coaches and specialized staff.
• Generate performance reports and indicators.
• Send relevant notifications related to your training plan and activities.
• Comply with applicable legal obligations.`,
      },
      {
        heading: '4. Legal Basis',
        body: `The processing of your data is based on:

• Your explicit consent when registering on the platform.
• The execution of the contractual/sports relationship between the athlete and the organization.
• Compliance with legal obligations.
• Our legitimate interests in the improvement and operation of the platform.`,
      },
      {
        heading: '5. Data Retention',
        body: `Your personal data will be retained for as long as you maintain an active account on the platform, and for the additional period necessary to comply with legal obligations or resolve disputes. Health data is retained in accordance with the deadlines established by applicable health regulations.`,
      },
      {
        heading: '6. Data Sharing',
        body: `We do not sell or transfer your personal data to third parties for commercial purposes. We may share your data with:

• Authorized platform personnel (coaches, doctors, nutritionists and other registered staff).
• Technology providers that support us in operating the service (Supabase for storage and authentication, Vercel for hosting), subject to confidentiality agreements.
• Competent authorities when required by law.`,
      },
      {
        heading: '7. Data Security',
        body: `We implement appropriate technical and organizational measures to protect your personal data against unauthorized access, loss, destruction or alteration. This includes in-transit encryption (TLS), role-based access control and secure authentication.`,
      },
      {
        heading: '8. Your Rights',
        body: `Under applicable law, you have the right to:

• Access your personal data.
• Rectify inaccurate or incomplete data.
• Request the deletion of your data (right to erasure).
• Object to the processing of your data.
• Request data portability.
• Withdraw your consent at any time.

To exercise these rights, contact: privacidad@aodeporte.com`,
      },
      {
        heading: '9. Children\'s Data',
        body: `The platform may be used by underage athletes under supervision and with the express consent of their parents or legal guardians. If you are a parent or guardian and have any concerns about the processing of a minor's data, please contact us immediately.`,
      },
      {
        heading: '10. Changes to This Notice',
        body: `We may update this Privacy Notice periodically. We will notify you of significant changes through a prominent notice in the application or by email. We recommend reviewing this notice regularly.`,
      },
      {
        heading: '11. Contact',
        body: `If you have questions or concerns about the processing of your personal data, you can contact us at:

AO Deportes
Email: privacidad@aodeporte.com
Website: aodeporte.com`,
      },
    ],
  },
};

export default async function PrivacyPolicyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const lang = locale === 'es' ? 'es' : 'en';
  const c = content[lang];
  const homeHref = `/${locale}`;

  return (
    <div style={{ backgroundColor: '#fcfcef', fontFamily: 'sans-serif', minHeight: '100vh' }}>
      {/* Header */}
      <header className="bg-white border-b border-gray-100 px-8 py-5">
        <div className="max-w-4xl mx-auto flex items-center gap-4">
          <Link href={homeHref} className="flex items-center gap-4 no-underline">
            <Image
              src="/logo.png"
              alt="AO Deportes"
              width={60}
              height={60}
              style={{ height: 'auto' }}
              priority
            />
            <span
              className={`${montserrat.className} font-black uppercase leading-none`}
              style={{ fontSize: '2rem', color: '#1a1a1a', letterSpacing: '-0.02em' }}
            >
              DEPORTE
              <span
                className={montserrat.className}
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  verticalAlign: 'super',
                  marginLeft: '2px',
                  color: '#7a7a7a',
                }}
              >
                .com
              </span>
            </span>
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-6 py-14">
        <h1
          className="font-black uppercase mb-2"
          style={{ fontSize: 'clamp(1.75rem, 4vw, 2.75rem)', color: '#b4051e' }}
        >
          {c.title}
        </h1>
        <p className="text-xs mb-10" style={{ color: '#7a7a7a' }}>
          {c.lastUpdated}
        </p>

        <div className="flex flex-col gap-8">
          {c.sections.map((section) => (
            <section key={section.heading}>
              <h2
                className="font-bold text-base mb-2 uppercase tracking-wide"
                style={{ color: '#1a1a1a' }}
              >
                {section.heading}
              </h2>
              <p
                className="text-sm leading-relaxed whitespace-pre-line"
                style={{ color: '#3a3a3a' }}
              >
                {section.body}
              </p>
            </section>
          ))}
        </div>
      </main>

      {/* Footer */}
      <footer
        className="py-6 text-center text-xs"
        style={{ backgroundColor: '#1a1a1a', color: '#7a7a7a' }}
      >
        © {new Date().getFullYear()} AO Deportes. Todos los derechos reservados.
      </footer>
    </div>
  );
}
