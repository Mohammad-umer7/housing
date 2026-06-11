// Auth utility functions
export const isUserLoggedIn = (): boolean => {
  if (typeof window === 'undefined') return false
  return !!localStorage.getItem('userRole')
}

export const getUserRole = (): 'admin' | 'user' | null => {
  if (typeof window === 'undefined') return null
  return (localStorage.getItem('userRole') as 'admin' | 'user') || null
}

export const getUserEmail = (): string | null => {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('userEmail')
}

export const setUserSession = (role: 'admin' | 'user', email: string) => {
  localStorage.setItem('userRole', role)
  localStorage.setItem('userEmail', email)
}

export const clearUserSession = () => {
  localStorage.removeItem('userRole')
  localStorage.removeItem('userEmail')
}

export const isAdmin = (): boolean => {
  return getUserRole() === 'admin'
}
