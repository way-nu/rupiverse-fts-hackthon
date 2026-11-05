import {Geist_400Regular, Geist_500Medium, Geist_600SemiBold, Geist_700Bold, useFonts} from "@expo-google-fonts/geist";

import "@/services"; // starts the API layer (and, in mock mode, window.__mock) before the first screen

export function useRootLayout() {
    const [loaded, error] = useFonts({Geist_400Regular, Geist_500Medium, Geist_600SemiBold, Geist_700Bold});
    return {ready: loaded || Boolean(error)};
}
