import { Clock, Mail, MapPin } from "lucide-react";
import { WhatsAppIcon } from "@/components/icons/WhatsAppIcon";
import { useGetStorefrontCompany } from "@workspace/api-client-react";
import { SITE_CONTACT, SITE_OPENING_HOURS } from "@/lib/site";
import { buildWhatsAppUrl } from "@/lib/whatsapp";

/**
 * Coluna de informações + o botão verde de WhatsApp do site original.
 * Endereço e telefone preferem o cadastro do admin (endpoint público) e caem
 * nas constantes locais quando vazios.
 */
export function ContactInfo() {
  const { data: company } = useGetStorefrontCompany();

  const rows = [
    {
      icon: WhatsAppIcon,
      label: "WhatsApp / Telefone",
      value: company?.phone || SITE_CONTACT.whatsappDisplay,
      href: buildWhatsAppUrl("Olá! Vim pelo site da Uaus."),
    },
    {
      icon: Mail,
      label: "E-mail",
      value: SITE_CONTACT.email,
      href: `mailto:${SITE_CONTACT.email}`,
    },
    {
      icon: MapPin,
      label: "Endereço",
      value: `${company?.addressLine || SITE_CONTACT.addressLine} — ${
        company?.cityState || SITE_CONTACT.addressDistrict
      }`,
      href: SITE_CONTACT.mapsPlaceUrl,
    },
  ];

  return (
    <div>
      <h3 className="text-2xl font-bold text-foreground">Informações de Contato</h3>

      <ul className="mt-6 space-y-2">
        {rows.map((row) => (
          <li key={row.label}>
            <a
              href={row.href}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-4 rounded-2xl p-3 transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-primary-strong focus-visible:ring-offset-2 focus-visible:outline-none"
            >
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-accent text-primary">
                <row.icon className="h-5 w-5" />
              </span>
              <span>
                <span className="block text-sm font-medium text-muted-foreground">{row.label}</span>
                <span className="font-bold text-foreground">{row.value}</span>
              </span>
            </a>
          </li>
        ))}
      </ul>

      <div className="mt-6 rounded-2xl border border-border bg-surface p-5">
        <p className="flex items-center gap-2 font-bold text-foreground">
          <Clock aria-hidden className="h-5 w-5 text-primary" />
          Horário de funcionamento
        </p>
        <dl className="mt-4 space-y-2">
          {SITE_OPENING_HOURS.map((rule) => (
            <div key={rule.days} className="flex flex-wrap justify-between gap-x-4 text-sm">
              <dt className="font-medium text-foreground">{rule.days}</dt>
              <dd className="text-muted-foreground">{rule.hours}</dd>
            </div>
          ))}
        </dl>
      </div>

      <a
        href={buildWhatsAppUrl("Olá! Vim pelo site da Uaus.")}
        target="_blank"
        rel="noreferrer"
        className="animate-pulse-glow mt-8 flex w-full items-center justify-center gap-2 rounded-2xl bg-green-700 px-6 py-5 text-center font-bold text-white shadow-sm transition-colors duration-200 hover:bg-green-600 focus-visible:ring-2 focus-visible:ring-green-700 focus-visible:ring-offset-2 focus-visible:outline-none"
      >
        <WhatsAppIcon className="h-5 w-5" />
        CHAMAR NO WHATSAPP
      </a>
    </div>
  );
}
