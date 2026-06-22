import { useEffect, useState } from 'react'

export type PosDeviceInfo = {
  orgName: string | null
  branchName: string | null
  deviceName: string | null
  deviceId: string | null
  loading: boolean
}

export function usePosDeviceInfo(): PosDeviceInfo {
  const [info, setInfo] = useState<PosDeviceInfo>({
    orgName: null,
    branchName: null,
    deviceName: null,
    deviceId: null,
    loading: true,
  })

  useEffect(() => {
    let cancelled = false

    function load() {
      void window.pos.settings.get().then((settings) => {
        if (cancelled) return
        setInfo({
          orgName: settings.org_name ?? null,
          branchName: settings.branch_name ?? null,
          deviceName: settings.device_name ?? null,
          deviceId: settings.device_id ?? null,
          loading: false,
        })
      }).catch(() => {
        if (!cancelled) setInfo(prev => ({ ...prev, loading: false }))
      })
    }

    load()
    window.addEventListener('focus', load)
    return () => {
      cancelled = true
      window.removeEventListener('focus', load)
    }
  }, [])

  return info
}
