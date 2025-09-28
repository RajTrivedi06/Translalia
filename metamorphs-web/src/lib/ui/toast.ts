export function toastError(message: string) {
  if (typeof window !== "undefined") {
    // Replace with your toast system if available
    alert(message);
  }
}
