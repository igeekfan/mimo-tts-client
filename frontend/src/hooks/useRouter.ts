import {useState, useEffect, useCallback} from 'react'

export function useRouter() {
    const getRoute = () => window.location.hash.slice(1) || '/'
    const [route, setRoute] = useState(getRoute)

    useEffect(() => {
        const onHashChange = () => setRoute(getRoute())
        window.addEventListener('hashchange', onHashChange)
        return () => window.removeEventListener('hashchange', onHashChange)
    }, [])

    const navigate = useCallback((path: string) => {
        window.location.hash = path
    }, [])

    return {route, navigate}
}
