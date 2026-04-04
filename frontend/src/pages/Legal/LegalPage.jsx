/**
 * LegalPage — Documentos legales de Revio
 * Rutas: /legal/terminos · /legal/privacidad · /legal/datos · /legal/cookies · /legal/sla
 */
import React from 'react';
import { Link, useParams, Navigate } from 'react-router-dom';
import { RevioIsotipo } from '../../components/ui/Logo.jsx';
import ThemeToggle from '../../components/ui/ThemeToggle.jsx';
import { useTheme } from '../../context/ThemeContext.jsx';

const EMPRESA = 'TRES HACHE ENTERPRISE SAS';
const NIT = '901696556-6';
const EMAIL = 'info@treshache.co';
const FECHA = '1 de abril de 2026';

const DOCS = {
  terminos: {
    title: 'Términos de Servicio',
    subtitle: 'Condiciones de uso de la plataforma Revio',
    sections: [
      {
        h: '1. Aceptación de los Términos',
        p: `Al acceder y utilizar la plataforma Revio, operada por ${EMPRESA} (NIT ${NIT}), usted acepta estar sujeto a estos Términos de Servicio. Si no está de acuerdo con alguna parte de estos términos, no podrá acceder al servicio.`,
      },
      {
        h: '2. Descripción del Servicio',
        p: 'Revio es una plataforma SaaS de Revenue Intelligence para hoteles y hostales en Latinoamérica. El servicio incluye: agente de ventas con inteligencia artificial, panel de gestión de reservas, integración con sistemas PMS, procesamiento de pagos, módulos de análisis de canales OTA, y herramientas de comunicación multicanal.',
      },
      {
        h: '3. Cuentas de Usuario',
        p: 'Usted es responsable de mantener la confidencialidad de su contraseña y de todas las actividades que ocurran bajo su cuenta. Debe notificarnos inmediatamente cualquier uso no autorizado. Solo puede crear una cuenta por establecimiento hotelero, salvo que contrate un plan que permita múltiples propiedades.',
      },
      {
        h: '4. Planes y Facturación',
        p: `Los planes de servicio son: Básico ($299.000 COP/mes, 1 propiedad), Pro ($599.000 COP/mes, propiedades ilimitadas) y Enterprise ($1.199.000 COP/mes). El periodo de prueba es de 14 días sin necesidad de tarjeta de crédito. Los pagos son mensuales o anuales. Al contratar el plan anual se otorgan 2 meses gratis. Los precios no incluyen impuestos aplicables en Colombia (IVA 19%).`,
      },
      {
        h: '5. Política de Cancelación',
        p: 'Puede cancelar su suscripción en cualquier momento desde el panel de facturación. Al cancelar, el servicio permanecerá activo hasta el final del periodo pagado. No se realizan reembolsos proporcionales por cancelaciones anticipadas, salvo en los casos previstos por la Ley 1480 de 2011 (Estatuto del Consumidor colombiano).',
      },
      {
        h: '6. Propiedad Intelectual',
        p: `La plataforma Revio, incluyendo su código, diseño, marca, logotipos y documentación, son propiedad exclusiva de ${EMPRESA}. Usted recibe una licencia limitada, no exclusiva e intransferible para usar el servicio durante la vigencia de su suscripción. Los datos generados por su negocio son de su propiedad.`,
      },
      {
        h: '7. Limitación de Responsabilidad',
        p: `${EMPRESA} no será responsable por daños indirectos, incidentales, especiales o consecuentes, incluyendo pérdida de ingresos o datos, derivados del uso o imposibilidad de uso del servicio. La responsabilidad total no excederá el monto pagado en los últimos 3 meses de servicio.`,
      },
      {
        h: '8. Disponibilidad del Servicio',
        p: 'Revio se esfuerza por mantener una disponibilidad del 99.5% mensual (para planes Pro y Básico) y 99.9% para planes Enterprise. El mantenimiento programado se notificará con al menos 24 horas de anticipación. No garantizamos disponibilidad ininterrumpida.',
      },
      {
        h: '9. Modificaciones',
        p: 'Nos reservamos el derecho de modificar estos Términos en cualquier momento. Las modificaciones significativas serán notificadas por correo electrónico con 30 días de anticipación. El uso continuado del servicio después de las modificaciones constituye aceptación de los nuevos términos.',
      },
      {
        h: '10. Ley Aplicable',
        p: 'Estos Términos se rigen por las leyes de la República de Colombia. Cualquier disputa será sometida a los tribunales de la ciudad de Bogotá D.C., Colombia, bajo la jurisdicción de la Superintendencia de Industria y Comercio cuando corresponda.',
      },
    ],
  },

  privacidad: {
    title: 'Política de Privacidad',
    subtitle: 'Tratamiento de datos personales conforme a la Ley 1581 de 2012',
    sections: [
      {
        h: '1. Responsable del Tratamiento',
        p: `${EMPRESA}, identificada con NIT ${NIT}, domiciliada en Colombia, es el Responsable del Tratamiento de los datos personales recolectados a través de la plataforma Revio. Contacto: ${EMAIL}.`,
      },
      {
        h: '2. Datos que Recolectamos',
        p: 'Recolectamos: (a) Datos de identificación: nombre, correo electrónico, teléfono, nombre del establecimiento. (b) Datos de uso: páginas visitadas, funciones utilizadas, frecuencia de acceso. (c) Datos de huéspedes: nombre, contacto y datos de reserva proporcionados por el operador hotelero. (d) Datos de pago: gestionados directamente por Wompi; no almacenamos números de tarjeta.',
      },
      {
        h: '3. Finalidades del Tratamiento',
        p: 'Los datos se utilizan para: prestar el servicio contratado, gestionar facturación y pagos, enviar comunicaciones relacionadas con el servicio, mejorar la plataforma mediante análisis agregados, cumplir obligaciones legales y fiscales colombianas, y atender solicitudes de los titulares.',
      },
      {
        h: '4. Base Legal',
        p: 'El tratamiento se basa en: el contrato de servicio suscrito (Art. 10 Ley 1581), el consentimiento explícito del titular para comunicaciones de marketing, y el cumplimiento de obligaciones legales ante autoridades colombianas.',
      },
      {
        h: '5. Derechos del Titular (ARCO)',
        p: `Conforme a la Ley 1581 de 2012, usted tiene derecho a: Acceder a sus datos, Rectificarlos, Cancelar su tratamiento, y Oponerse a finalidades específicas. Para ejercer estos derechos, envíe solicitud a ${EMAIL} con asunto "Derechos ARCO". Responderemos en 10 días hábiles.`,
      },
      {
        h: '6. Transferencias Internacionales',
        p: 'Los datos pueden ser procesados en servidores de Supabase (US-East) con garantías contractuales equivalentes a las colombianas. No vendemos ni cedemos datos a terceros para fines comerciales propios.',
      },
      {
        h: '7. Conservación',
        p: 'Conservamos los datos durante la vigencia del contrato y por 5 años adicionales para cumplir obligaciones fiscales y legales colombianas (Código de Comercio). Los datos de huéspedes se eliminan a solicitud del operador o tras 2 años de inactividad.',
      },
      {
        h: '8. Seguridad',
        p: 'Implementamos medidas técnicas y organizativas: cifrado en tránsito (TLS 1.3), acceso mediante autenticación JWT, auditoría de accesos, y copias de seguridad diarias. Los datos se almacenan en Supabase con Row Level Security activado.',
      },
      {
        h: '9. Actualizaciones',
        p: `Esta política fue actualizada el ${FECHA}. Cambios sustanciales serán notificados por correo electrónico. Puede consultar versiones anteriores en nuestra página de cambios.`,
      },
    ],
  },

  datos: {
    title: 'Política de Datos de Huéspedes',
    subtitle: 'Tratamiento de datos de terceros gestionados por operadores hoteleros',
    sections: [
      {
        h: '1. Rol de Encargado del Tratamiento',
        p: `${EMPRESA} actúa como Encargado del Tratamiento respecto a los datos de huéspedes que los operadores hoteleros (Responsables) introducen en Revio, conforme al Art. 3 literal d) de la Ley 1581 de 2012.`,
      },
      {
        h: '2. Datos de Huéspedes Procesados',
        p: 'Se procesan: nombre completo, número de teléfono, correo electrónico, fechas de reserva, tipo de habitación, valor de la transacción, y conversaciones con el agente de IA. No se recolectan documentos de identidad ni datos sensibles conforme al Art. 5 de la Ley 1581.',
      },
      {
        h: '3. Instrucciones del Responsable',
        p: 'El operador hotelero (cliente de Revio) instruye el tratamiento exclusivamente para: gestión de reservas, comunicaciones de servicio al huésped, y análisis de ocupación. Cualquier uso adicional requiere instrucción expresa del operador.',
      },
      {
        h: '4. Sub-encargados',
        p: 'Utilizamos Supabase Inc. como sub-encargado para almacenamiento, con cláusulas contractuales de protección de datos. El operador hotelero acepta esta sub-contratación al usar Revio.',
      },
      {
        h: '5. Obligaciones del Operador Hotelero',
        p: 'El operador es responsable de: obtener consentimiento de sus huéspedes para el tratamiento de datos, informar a los huéspedes sobre el uso de sistemas de IA en comunicaciones, y responder a solicitudes ARCO de huéspedes.',
      },
      {
        h: '6. Retención y Eliminación',
        p: 'Los datos de huéspedes se retienen mientras el operador mantenga su cuenta activa. Tras la cancelación, los datos se eliminan en 30 días, salvo que el operador solicite exportación previa. Podemos retener datos anonimizados para análisis agregados.',
      },
      {
        h: '7. Notificación de Incidentes',
        p: `En caso de brecha de seguridad que afecte datos de huéspedes, notificaremos al operador dentro de las 72 horas siguientes al conocimiento del incidente, y a la Superintendencia de Industria y Comercio conforme a la circular 02 de 2015.`,
      },
    ],
  },

  cookies: {
    title: 'Política de Cookies',
    subtitle: 'Uso de cookies y tecnologías de seguimiento en Revio',
    sections: [
      {
        h: '¿Qué son las Cookies?',
        p: 'Las cookies son pequeños archivos de texto que se almacenan en su dispositivo cuando visita nuestra plataforma. Nos permiten recordar preferencias, mantener sesiones activas y analizar el uso del servicio.',
      },
      {
        h: 'Cookies Estrictamente Necesarias',
        p: 'Estas cookies son esenciales para el funcionamiento de Revio y no pueden desactivarse: (1) mystica_token / sa_token: token de autenticación JWT, válido por 24 horas. (2) theme: preferencia de modo oscuro/claro. Sin estas cookies, no podemos ofrecer el servicio.',
      },
      {
        h: 'Cookies de Rendimiento',
        p: 'Con su consentimiento, utilizamos: (1) Análisis de uso de funciones del panel (anónimo y agregado). (2) Tiempos de carga de páginas para optimización. No compartimos estos datos con terceros para publicidad.',
      },
      {
        h: 'Almacenamiento Local (localStorage / sessionStorage)',
        p: 'Usamos almacenamiento local del navegador para: token de autenticación (localStorage), datos de sesión de onboarding (sessionStorage, se elimina al cerrar el navegador). Estos no son cookies pero funcionan de manera similar.',
      },
      {
        h: 'Gestión de Preferencias',
        p: 'Puede gestionar cookies desde la configuración de su navegador. Tenga en cuenta que deshabilitar cookies necesarias impedirá el uso del panel. Chrome: Configuración > Privacidad > Cookies. Safari: Preferencias > Privacidad. Firefox: Opciones > Privacidad y seguridad.',
      },
      {
        h: 'Terceros',
        p: 'No utilizamos cookies de redes sociales ni de publicidad. Las fuentes tipográficas se cargan desde Google Fonts (política de privacidad en fonts.google.com). Los pagos se procesan en el dominio de Wompi, sujeto a su propia política de cookies.',
      },
      {
        h: 'Contacto',
        p: `Para preguntas sobre el uso de cookies, contáctenos en ${EMAIL}.`,
      },
    ],
  },

  sla: {
    title: 'Acuerdo de Nivel de Servicio (SLA)',
    subtitle: 'Compromisos de disponibilidad y soporte técnico',
    sections: [
      {
        h: '1. Disponibilidad Garantizada',
        p: 'Revio garantiza los siguientes niveles de disponibilidad mensual: Plan Básico y Pro: 99.5% (≈ 3.6 horas de interrupción permitidas/mes). Plan Enterprise: 99.9% (≈ 43 minutos/mes). La disponibilidad excluye mantenimientos programados notificados con 24 horas de anticipación.',
      },
      {
        h: '2. Compensaciones por Incumplimiento',
        p: 'Si no alcanzamos la disponibilidad garantizada en un mes, otorgamos créditos de servicio: Disponibilidad 99.0%-99.5%: 10% del cargo mensual. Disponibilidad 95.0%-99.0%: 25% del cargo mensual. Disponibilidad < 95.0%: 50% del cargo mensual. Los créditos se aplican en la siguiente factura.',
      },
      {
        h: '3. Tiempos de Respuesta de Soporte',
        p: 'Plan Básico: soporte por email, respuesta en 48 horas hábiles. Plan Pro: soporte por email y chat, respuesta en 8 horas hábiles. Plan Enterprise: soporte prioritario 24/7 por WhatsApp y email, respuesta en 2 horas. Incidentes críticos (servicio caído): respuesta en 1 hora para todos los planes.',
      },
      {
        h: '4. Mantenimiento Programado',
        p: 'Los mantenimientos se realizarán preferentemente los domingos entre 2:00 AM y 6:00 AM (hora de Colombia). Se notificará con al menos 24 horas de anticipación por correo electrónico. El tiempo de mantenimiento programado no cuenta para el cálculo de disponibilidad.',
      },
      {
        h: '5. Exclusiones',
        p: 'Este SLA no aplica para interrupciones causadas por: fuerza mayor, ataques de denegación de servicio (DDoS), fallas en servicios de terceros (LobbyPMS, Wompi, proveedor de telecomunicaciones del cliente), errores en configuraciones realizadas por el cliente, o incumplimiento de estos Términos por parte del cliente.',
      },
      {
        h: '6. Monitoreo',
        p: 'Revio monitorea la disponibilidad del servicio en tiempo real. El estado actual del sistema puede consultarse en el panel de control (sección Monitor de Salud). Los incidentes se registran y están disponibles para revisión del cliente.',
      },
      {
        h: '7. Procedimiento de Reclamación',
        p: `Para reclamar créditos SLA, envíe un correo a ${EMAIL} con asunto "Reclamación SLA [mes/año]" dentro de los 30 días siguientes al incidente, incluyendo las fechas y duración aproximada de la interrupción. Evaluaremos la reclamación en 5 días hábiles.`,
      },
    ],
  },
};

function LegalDoc({ slug }) {
  const doc = DOCS[slug];
  const { dark } = useTheme();

  if (!doc) return <Navigate to="/legal/terminos" replace />;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text-1)' }}>
      {/* Header */}
      <header style={{
        padding: '16px 32px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: '1px solid var(--border)',
        position: 'sticky', top: 0, background: 'var(--bg)', zIndex: 10,
      }}>
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
          <RevioIsotipo size={26} />
          <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-1)' }}>
            rev<span style={{ color: 'var(--accent)' }}>io</span>
          </span>
        </Link>
        <ThemeToggle />
      </header>

      {/* Nav tabs */}
      <nav style={{
        display: 'flex', gap: 0, overflowX: 'auto',
        borderBottom: '1px solid var(--border)',
        padding: '0 32px',
      }}>
        {Object.entries(DOCS).map(([key, d]) => (
          <Link key={key} to={`/legal/${key}`} style={{
            padding: '12px 18px',
            fontSize: 13, fontWeight: 500,
            color: slug === key ? 'var(--accent)' : 'var(--text-3)',
            borderBottom: slug === key ? '2px solid var(--accent)' : '2px solid transparent',
            textDecoration: 'none',
            whiteSpace: 'nowrap',
            transition: 'color .2s',
          }}>{d.title}</Link>
        ))}
      </nav>

      {/* Content */}
      <main style={{ maxWidth: 760, margin: '0 auto', padding: '48px 24px 80px' }}>
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8, color: 'var(--text-1)' }}>
            {doc.title}
          </h1>
          <p style={{ fontSize: 14, color: 'var(--text-3)' }}>{doc.subtitle}</p>
          <div style={{
            marginTop: 16, padding: '10px 16px', borderRadius: 10,
            background: 'color-mix(in srgb, var(--accent) 8%, transparent)',
            border: '1px solid color-mix(in srgb, var(--accent) 20%, transparent)',
            fontSize: 13, color: 'var(--text-2)',
          }}>
            Última actualización: {FECHA} · {EMPRESA} · NIT {NIT} · {EMAIL}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
          {doc.sections.map((s, i) => (
            <section key={i}>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-1)', marginBottom: 10 }}>
                {s.h}
              </h2>
              <p style={{ fontSize: 14, lineHeight: 1.75, color: 'var(--text-2)' }}>{s.p}</p>
            </section>
          ))}
        </div>
      </main>

      {/* Footer */}
      <footer style={{
        borderTop: '1px solid var(--border)',
        padding: '24px 32px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12,
        fontSize: 12, color: 'var(--text-3)',
      }}>
        <span>© {new Date().getFullYear()} Revio · {EMPRESA} · NIT {NIT}</span>
        <div style={{ display: 'flex', gap: 20 }}>
          {Object.entries(DOCS).map(([key, d]) => (
            <Link key={key} to={`/legal/${key}`} style={{ color: 'var(--text-3)', textDecoration: 'none' }}>
              {d.title}
            </Link>
          ))}
        </div>
      </footer>
    </div>
  );
}

export default function LegalPage() {
  const { slug } = useParams();
  return <LegalDoc slug={slug} />;
}
