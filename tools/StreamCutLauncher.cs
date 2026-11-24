using System;
using System.Diagnostics;
using System.IO;
using System.Net;
using System.Threading;
using System.Windows.Forms;

namespace StreamCut
{
    static class Program
    {
        [STAThread]
        static void Main()
        {
            try
            {
                string exeDir = AppDomain.CurrentDomain.BaseDirectory;
                string serverScript = Path.Combine(exeDir, "server.mjs");
                string port = "5173";
                string url = "http://localhost:" + port;

                // Check if server is already running
                bool serverRunning = false;
                try
                {
                    var req = (HttpWebRequest)WebRequest.Create(url);
                    req.Timeout = 1000;
                    using (var res = req.GetResponse())
                    {
                        serverRunning = true;
                    }
                }
                catch { }

                if (!serverRunning && File.Exists(serverScript))
                {
                    var nodeStartInfo = new ProcessStartInfo
                    {
                        FileName = "node.exe",
                        Arguments = "\"" + serverScript + "\" --lan",
                        WorkingDirectory = exeDir,
                        CreateNoWindow = true,
                        UseShellExecute = false,
                        WindowStyle = ProcessWindowStyle.Hidden
                    };
                    Process.Start(nodeStartInfo);

                    // Wait up to 5 seconds for server to start
                    for (int i = 0; i < 15; i++)
                    {
                        Thread.Sleep(300);
                        try
                        {
                            var req = (HttpWebRequest)WebRequest.Create(url);
                            req.Timeout = 1000;
                            using (var res = req.GetResponse())
                            {
                                break;
                            }
                        }
                        catch { }
                    }
                }

                // Locate Edge or Chrome for dedicated App Window mode
                string edgePath = @"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe";
                string chromePath = @"C:\Program Files\Google\Chrome\Application\chrome.exe";
                string chromeUser = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), @"Google\Chrome\Application\chrome.exe");

                string browser = null;
                if (File.Exists(edgePath)) browser = edgePath;
                else if (File.Exists(chromePath)) browser = chromePath;
                else if (File.Exists(chromeUser)) browser = chromeUser;

                if (!string.IsNullOrEmpty(browser))
                {
                    string profileDir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "StreamCutApp");
                    Process.Start(new ProcessStartInfo
                    {
                        FileName = browser,
                        Arguments = "--app=\"" + url + "\" --user-data-dir=\"" + profileDir + "\"",
                        UseShellExecute = true
                    });
                }
                else
                {
                    Process.Start(new ProcessStartInfo
                    {
                        FileName = url,
                        UseShellExecute = true
                    });
                }
            }
            catch (Exception ex)
            {
                MessageBox.Show("Could not launch StreamCut: " + ex.Message, "StreamCut Error", MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
        }
    }
}
