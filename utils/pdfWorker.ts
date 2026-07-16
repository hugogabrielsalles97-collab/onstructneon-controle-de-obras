/**
 * Worker do pdf.js com o polyfill de Uint8Array carregado ANTES do worker real.
 *
 * O Web Worker tem escopo global próprio, separado da página — por isso o polyfill
 * precisa rodar aqui dentro também. A ordem dos imports importa: o polyfill primeiro,
 * depois o worker do pdf.js, que passa a encontrar `toHex()` já disponível.
 *
 * Referenciado via `?worker` (Vite empacota este arquivo como worker e resolve o
 * import "bare" do pdfjs-dist).
 */
import './uint8Polyfill';
import 'pdfjs-dist/build/pdf.worker.min.mjs';
