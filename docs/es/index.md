# Documentación de WhyNot QA (Español)

Bienvenido a la documentación en español de WhyNot QA.

## Internacionalización (i18n)

- [Cómo agregar una clave de traducción](i18n/how-to-add-a-translation-key.md)

## Convenciones del idioma español

WhyNot QA usa **español neutro latinoamericano** para la interfaz:

- **Tratamiento formal**: se usa "usted" en lugar de "tú".
- **Puntuación invertida**: las preguntas usan `¿...?` y las exclamaciones `¡...!`.
- **Formato de números**: estilo `es-419` (miles con `,`, decimales con `.`) — ej. `1,234.56`.
- **Formato de fechas**: `Intl.DateTimeFormat("es-419", ...)` — ej. `15 de abril de 2026`.
- **Términos técnicos**: se preservan los nombres de tecnologías sin traducir (Playwright, GitHub, Stripe, CI/CD).

### Glosario de términos

| Inglés | Español |
|--------|---------|
| Test run | Ejecución de prueba |
| Flaky test | Prueba inestable |
| Dashboard | Panel de control |
| Sign in | Iniciar sesión |
| Sign up | Registrarse |
| Settings | Configuración |
| Billing | Facturación |
| API key | Clave de API |
| Workspace | Espacio de trabajo |
| Bug | Error |
| Monitor | Monitor |
| Scan | Escaneo |

### Archivos de traducción

**Frontend** (`frontend/public/locales/es/`):
- `common.json` — autenticación, errores, navegación, onboarding
- `auth.json` — autenticación de dos factores
- `dashboard.json` — proyectos, entornos, monitores, integraciones
- `runner.json` — ejecutor de pruebas, QA Loop, rendimiento
- `results.json` — resultados, casos de prueba, regresión visual
- `settings.json` — perfil, organización, claves de API, notificaciones
- `billing.json` — planes, créditos, facturas, checkout
- `landing.json` — páginas de marketing

**Admin-frontend** (`admin-frontend/public/locales/es/`):
- `common.json` — navegación, tablas, formularios, estados
- `admin.json` — feature flags, proveedores de IA, facturación, auditoría
- `auth.json` — inicio de sesión del administrador
- `settings.json` — configuración del sistema
- `superadmin.json` — planes, suscripciones, créditos
