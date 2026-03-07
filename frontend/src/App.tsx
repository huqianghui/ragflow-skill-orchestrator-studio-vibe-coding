import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import AppLayout from './components/AppLayout';
import Dashboard from './pages/Dashboard';
import SkillLibrary from './pages/SkillLibrary';
import SkillEditor from './pages/SkillEditor';
import BuiltinSkillEditor from './pages/BuiltinSkillEditor';
import Connections from './pages/Connections';
import Pipelines from './pages/Pipelines';
import PipelineEditor from './pages/PipelineEditor';
import DataSources from './pages/DataSources';
import DataSourceNew from './pages/DataSourceNew';
import Targets from './pages/Targets';
import RunHistory from './pages/RunHistory';
import Settings from './pages/Settings';

export default function App() {
  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: '#1677ff',
          borderRadius: 6,
        },
      }}
    >
      <BrowserRouter>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/skills" element={<SkillLibrary />} />
            <Route path="/skills/new" element={<SkillEditor />} />
            <Route path="/skills/:id/edit" element={<SkillEditor />} />
            <Route path="/skills/:id/configure" element={<BuiltinSkillEditor />} />
            <Route path="/connections" element={<Connections />} />
            <Route path="/pipelines" element={<Pipelines />} />
            <Route path="/pipelines/:id" element={<PipelineEditor />} />
            <Route path="/data-sources/new" element={<DataSourceNew />} />
            <Route path="/data-sources" element={<DataSources />} />
            <Route path="/targets" element={<Targets />} />
            <Route path="/runs" element={<RunHistory />} />
            <Route path="/settings" element={<Settings />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ConfigProvider>
  );
}
