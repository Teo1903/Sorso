import { forwardRef, type ChangeEvent } from 'react'

/** Input file nascosto: con `camera` apre direttamente la fotocamera posteriore. */
export const HiddenPhotoInput = forwardRef<
  HTMLInputElement,
  { camera?: boolean; onFile: (f: File) => void; id?: string }
>(function HiddenPhotoInput({ camera, onFile, id }, ref) {
  const handle = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    e.target.value = '' // permette di riselezionare lo stesso file
    if (f) onFile(f)
  }
  return (
    <input
      ref={ref}
      id={id}
      type="file"
      accept="image/*"
      {...(camera ? { capture: 'environment' as const } : {})}
      className="hidden"
      onChange={handle}
    />
  )
})

/** Foto in attesa tra il "+" della home e la schermata Nuova. */
let pending: File | null = null
export const setPendingPhoto = (f: File | null) => {
  pending = f
}
export const takePendingPhoto = (): File | null => {
  const f = pending
  pending = null
  return f
}
