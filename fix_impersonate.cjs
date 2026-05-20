const fs = require('fs');

let content = fs.readFileSync('src/components/AdminDashboard.tsx', 'utf8');

const target = `<td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {isAdmin && (
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setStaffToDelete(member.uid);
                            }}`;

const replacement = `<td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {isMainAdmin && onImpersonate && member.email !== profile?.email && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onImpersonate(member);
                            }}
                            title="Log in as user"
                            className="p-2 hover:bg-amber-50 text-amber-500 hover:text-amber-600 rounded-lg transition-all"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        )}
                        {isAdmin && (
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setStaffToDelete(member.uid);
                            }}`;

content = content.replace(new RegExp(target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), replacement);

fs.writeFileSync('src/components/AdminDashboard.tsx', content);
console.log('Fixed Impersonate buttons');
