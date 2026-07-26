# ApexEnem Mobile

App nativo Android do ApexEnem — plataforma 100% gratuita de estudos para o ENEM.

## Stack
- **React Native** (Expo SDK 57)
- **Expo Router** (navegação)
- **Supabase** (auth + banco)
- **TypeScript**

## Telas
- Login/Cadastro (email + senha)
- Dashboard (stats, XP, nível, streak)
- Redação (correção por 10 IAs via CURA)
- Simulados (questões reais do ENEM)
- Questões IA (geradas por IA)
- Estudos/Aulas (geradas por IA)
- Perfil (29 conquistas, radar chart)
- Configurações (dark mode, reiniciar/excluir conta)

## Build APK (cloud)

### Opção 1: EAS Build (recomendado)
1. Crie conta gratuita em [expo.dev](https://expo.dev)
2. Instale EAS CLI: `npm install -g eas-cli`
3. Login: `eas login`
4. Configure: `eas build:configure`
5. Build APK: `eas build --platform android --profile preview`
6. O APK será baixado do link fornecido

### Opção 2: GitHub Actions
1. Crie o repo no GitHub
2. Adicione secret `EXPO_TOKEN` (token do expo.dev)
3. Push para `main` — o workflow builda automaticamente
4. Baixe o APK em Actions → Artifacts

## Configuração
Edite `lib/supabase.ts` e adicione sua `supabaseAnonKey`.

```bash
# Rodar localmente
npm install
npx expo start
```

Escaneie o QR code com Expo Go (Android/iOS).
