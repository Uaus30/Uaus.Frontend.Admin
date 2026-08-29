import { Mail, MapPin, MessageCircle } from "lucide-react";
import { useGetStorefrontCompany } from "@workspace/api-client-react";
import { SITE_CONTACT } from "@/lib/site";
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
      icon: MessageCircle,
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
      href: SITE_CONTACT.mapsShareUrl,
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
              className="flex items-center gap-4 rounded-2xl p-3 transition-colors hover:bg-orange-50"
            >
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
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

      <a
        href={buildWhatsAppUrl("Olá! Vim pelo site da Uaus.")}
        target="_blank"
        rel="noreferrer"
        className="animate-pulse-glow mt-8 block w-full rounded-2xl bg-green-600 px-6 py-5 text-center font-black text-white shadow-xl transition-all duration-700 hover:-translate-y-1 hover:bg-green-500"
      >
        CHAMAR NO WHATSAPP
      </a>
    </div>
  );
}
