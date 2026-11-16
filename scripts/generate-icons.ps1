Add-Type -AssemblyName System.Drawing

function Create-StreamCutIcon {
    param(
        [int]$Size,
        [string]$OutFile,
        [bool]$Maskable = $false
    )

    $bmp = New-Object System.Drawing.Bitmap($Size, $Size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

    $rect = New-Object System.Drawing.Rectangle(0, 0, $Size, $Size)
    $cTop = [System.Drawing.Color]::FromArgb(255, 24, 19, 43)
    $cBottom = [System.Drawing.Color]::FromArgb(255, 10, 7, 21)
    $bgBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush($rect, $cTop, $cBottom, 45.0)

    if ($Maskable) {
        $g.FillRectangle($bgBrush, $rect)
    } else {
        $radius = [int]($Size * 0.22)
        $d = $radius * 2
        $gp = New-Object System.Drawing.Drawing2D.GraphicsPath
        $gp.AddArc(0, 0, $d, $d, 180, 90)
        $gp.AddArc($Size - $d, 0, $d, $d, 270, 90)
        $gp.AddArc($Size - $d, $Size - $d, $d, $d, 0, 90)
        $gp.AddArc(0, $Size - $d, $d, $d, 90, 90)
        $gp.CloseFigure()
        $g.FillPath($bgBrush, $gp)

        $borderPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(45, 255, 255, 255), [float]([Math]::Max(1.0, $Size * 0.015)))
        $g.DrawPath($borderPen, $gp)
        $borderPen.Dispose()
        $gp.Dispose()
    }
    $bgBrush.Dispose()

    # Draw Cyan / Lime Cut Bar
    $barX = [float]($Size * 0.32)
    $barY1 = [float]($Size * 0.37)
    $barY2 = [float]($Size * 0.63)
    $barWidth = [float]([Math]::Max(2.0, $Size * 0.055))
    $barPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(255, 190, 242, 100), $barWidth)
    $barPen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $barPen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
    $g.DrawLine($barPen, $barX, $barY1, $barX, $barY2)
    $barPen.Dispose()

    # Draw Triangle Play Button (Lime to Violet gradient)
    $p1 = New-Object System.Drawing.PointF([float]($Size * 0.41), [float]($Size * 0.31))
    $p2 = New-Object System.Drawing.PointF([float]($Size * 0.70), [float]($Size * 0.50))
    $p3 = New-Object System.Drawing.PointF([float]($Size * 0.41), [float]($Size * 0.69))
    $triPoints = [System.Drawing.PointF[]]@($p1, $p2, $p3)

    $triRect = New-Object System.Drawing.RectangleF([float]($Size * 0.41), [float]($Size * 0.31), [float]($Size * 0.30), [float]($Size * 0.38))
    $triBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush($triRect, [System.Drawing.Color]::FromArgb(255, 190, 242, 100), [System.Drawing.Color]::FromArgb(255, 167, 139, 250), 30.0)
    $g.FillPolygon($triBrush, $triPoints)
    $triBrush.Dispose()

    $bmp.Save($OutFile, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose()
    $bmp.Dispose()
    Write-Host "Created $OutFile ($Size x $Size)"
}

Create-StreamCutIcon -Size 512 -OutFile "public/icon-512.png"
Create-StreamCutIcon -Size 192 -OutFile "public/icon-192.png"
Create-StreamCutIcon -Size 512 -OutFile "public/icon-maskable-512.png" -Maskable $true
Create-StreamCutIcon -Size 48 -OutFile "public/favicon.png"
Create-StreamCutIcon -Size 44 -OutFile "public/store-icon-44.png"
Create-StreamCutIcon -Size 150 -OutFile "public/store-icon-150.png"
Create-StreamCutIcon -Size 620 -OutFile "public/store-splash-620.png"
