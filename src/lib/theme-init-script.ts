/**
 * Blocking theme bootstrap for SSR — must match next-themes@0.4.6 defaults in Providers.tsx.
 * Rendered from root layout (Server Component) so next-themes does not inject a <script>
 * inside the client tree (React 19 hydration mismatch).
 */
export const THEME_INIT_INLINE = `(function(){var d=document.documentElement,w=["light","dark"],a="class",k="theme",def="system",forced=null,themes=["light","dark"],val=null,sys=!0,color=!0;function apply(n){(Array.isArray(a)?a:[a]).forEach(function(y){var isClass=y==="class",list=isClass?themes.map(function(t){return val&&val[t]||t}):themes;if(isClass){d.classList.remove.apply(d.classList,list);d.classList.add(val&&val[n]?val[n]:n)}else{d.setAttribute(y,n)}});if(color&&w.indexOf(n)>=0)d.style.colorScheme=n}function system(){return window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}if(forced)apply(forced);else try{var stored=localStorage.getItem(k)||def,resolved=sys&&stored==="system"?system():stored;apply(resolved)}catch(e){}})();`
