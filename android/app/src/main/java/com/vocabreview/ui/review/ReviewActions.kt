package com.vocabreview.ui.review

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Help
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.vocabreview.ui.theme.AppColors
import com.vocabreview.ui.theme.Radius
import com.vocabreview.ui.theme.Spacing

@Composable
fun ReviewActions(
    onMiss: () -> Unit,
    onHard: () -> Unit,
    onGood: () -> Unit,
    modifier: Modifier = Modifier
) {
    Row(
        modifier = modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(Spacing.md)
    ) {
        ActionButton(
            icon = Icons.Default.Close,
            label = "忘了",
            color = AppColors.StatDue,
            onClick = onMiss,
            modifier = Modifier.weight(1f)
        )
        ActionButton(
            icon = Icons.Default.Help,
            label = "模糊",
            color = Color(0xFFF5A623),
            onClick = onHard,
            modifier = Modifier.weight(1f)
        )
        ActionButton(
            icon = Icons.Default.CheckCircle,
            label = "记得",
            color = AppColors.StatMastered,
            onClick = onGood,
            modifier = Modifier.weight(1f)
        )
    }
}

@Composable
private fun ActionButton(
    icon: ImageVector,
    label: String,
    color: Color,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    val interactionSource = remember { MutableInteractionSource() }
    val isPressed by interactionSource.collectIsPressedAsState()
    val scale by animateFloatAsState(if (isPressed) 0.93f else 1f, label = "press")

    Row(
        modifier = modifier
            .scale(scale)
            .clip(RoundedCornerShape(Radius.medium))
            .background(color.copy(alpha = 0.1f))
            .clickable(
                interactionSource = interactionSource,
                indication = null,
                onClick = onClick
            )
            .padding(vertical = Spacing.md),
        horizontalArrangement = Arrangement.Center,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Icon(
            imageVector = icon,
            contentDescription = label,
            tint = color,
            modifier = Modifier.size(20.dp)
        )
        Spacer(Modifier.width(Spacing.xs))
        Text(
            text = label,
            fontSize = 13.sp,
            fontWeight = FontWeight.Medium,
            color = color
        )
    }
}
