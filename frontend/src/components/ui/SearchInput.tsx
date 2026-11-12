import { TextInput, type TextInputProps } from './TextInput'

export function SearchInput({ placeholder = 'Buscar…', ...rest }: TextInputProps) {
  return (
    <div className="bd-search">
      <TextInput icon="search" type="search" placeholder={placeholder} aria-label={placeholder} {...rest} />
    </div>
  )
}
