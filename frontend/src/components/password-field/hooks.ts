import {useState} from "react";

export function usePasswordReveal() {
    const [revealed, setRevealed] = useState(false);
    return {revealed, toggle: () => setRevealed((value) => !value)};
}
