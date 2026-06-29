import { Routes, Route, Navigate } from 'react-router-dom'
import GroupSettingsHub from './GroupSettingsHub'
import GroupSettingsInfo from './GroupSettingsInfo'
import GroupSettingsJoin from './GroupSettingsJoin'
import GroupSettingsAdmins from './GroupSettingsAdmins'
import GroupSettingsMemberAdmin from './GroupSettingsMemberAdmin'

export default function GroupSettingsRoutes() {
  return (
    <Routes>
      <Route index element={<GroupSettingsHub />} />
      <Route path="info" element={<GroupSettingsInfo />} />
      <Route path="join" element={<GroupSettingsJoin />} />
      <Route path="admins" element={<GroupSettingsAdmins />} />
      <Route path="admins/:memberId" element={<GroupSettingsMemberAdmin />} />
      <Route path="roles" element={<Navigate to="../admins" replace />} />
      <Route path="roles/:memberId" element={<Navigate to="../admins" replace />} />
      <Route path="*" element={<Navigate to="." replace relative="path" />} />
    </Routes>
  )
}
