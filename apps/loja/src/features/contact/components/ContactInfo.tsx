import type { ComponentType } from "react";
import { Clock, Mail, MapPin } from "lucide-react";
import { WhatsAppIcon } from "@/components/icons/WhatsAppIcon";
import { useGetStorefrontCompany } from "@workspace/api-client-react";
import { SITE_CONTACT, SITE_OPENING_HOURS, SITE_PHONES } from "@/lib/site";
import { buildWhatsAppUrl } from "@/lib/whatsapp";

/** Mensagem que já abre digitada no WhatsApp — diz a quem atende de onde veio o contato. */
const CONTACT_WHATSAPP_MESSAGE = "Olá! Vim pelo site da Uaus.";

/** Uma linha clicável da coluna de informações. */
interface ContactRow {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
  href: string;
}

/**
 * Coluna de informações + o botão verde de WhatsApp do site original.
 *
 * Os TELEFONES vêm de `SITE_PHONES` — os mesmos três do rodapé, na mesma
 * ordem — e não da API. O `/Storefront/company` devolve um `phone` só, sem
 * nome de quem atende, e o que está gravado nele hoje é o celular de um
 * sócio: por ele a página anunciaria como número da loja um número que não é
 * o canal padrão dela. O endereço continua preferindo o cadastro do admin, lá
 * o campo e o dado são o mesmo e a API é a fonte mais fresca.
 *
 * Todas as três linhas abrem o wa.me do respectivo número, e não um `tel:`:
 * o site inteiro converte por WhatsApp, e ligação de voz para celular de
 * comércio local costuma cair na caixa.
 */
export function ContactInfo() {
  const { data: company } = useGetStorefrontCompany();

  const rows: ContactRow[] = [
    ...SITE_PHONES.map((phone) => ({
      icon: WhatsAppIcon,
      label: `WhatsApp — ${phone.label}`,
      value: phone.display,
      href: buildWhatsAppUrl(CONTACT_WHATSAPP_MESSAGE, phone.number),
    })),
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
              className="flex items-center gap-4 rounded-2xl p-3 transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:outline-none"
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
        href={buildWhatsAppUrl(CONTACT_WHATSAPP_MESSAGE)}
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
